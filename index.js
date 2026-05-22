// Bismillah
//===============
// Apologies for too many comments, but I wanted to make sure everything is clear for me so that I can easily come back to this code in the future and understand it without much effort. I will try to keep the comments concise though.
//===============

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

const app = express();
app.use(cors());
app.use(express.json());

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>চাচা আপনে?</title>
        <style>
          body {
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f0f0f0;
          }
          img {
            max-width: 90%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <img src="https://i0.wp.com/www.memelate.com/wp-content/uploads/2023/04/manna-obak-meme-template.png" alt="চাচা আপনে?">
      </body>
    </html>
  `);
});

// Converting ISO date string into YYYY-MM-DD format
const normalizeDate = (date) => String(date ?? "").split("T")[0];
// Normalizing time into HH:MM format
const normalizeTime = (time) => {
  const [hours, minutes = "0"] = String(time ?? "")
    .trim()
    .split(":");
  const hour = Number(hours);
  const minute = Number(minutes);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  // Using padStart() for the first time to ensure two-digit formatting for hours and minutes
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

// Converting roomId to both ObjectId and string formats as I am sending roomId from the BookingButton component.
const buildRoomIdFilter = (roomId) => {
  const roomIdString = String(roomId);

  return {
    $or: [{ roomId: new ObjectId(roomIdString) }, { roomId: roomIdString }],
  };
};

// Validating and normalizing time and date booking input before checking DB conflicts.
const findBookingConflict = async (
  bookingsCollection,
  { roomId, date, startTime, endTime, excludeBookingId },
) => {
  const normalizedDate = normalizeDate(date);
  const normalizedStart = normalizeTime(startTime);
  const normalizedEnd = normalizeTime(endTime);

  if (!normalizedDate || !normalizedStart || !normalizedEnd) {
    return { invalid: true };
  }

  if (normalizedStart >= normalizedEnd) {
    return { invalid: true };
  }

  const filter = {
    ...buildRoomIdFilter(roomId),
    date: normalizedDate,
    status: "confirmed",
    startTime: { $lt: normalizedEnd },
    endTime: { $gt: normalizedStart },
  };

  if (excludeBookingId) {
    filter._id = { $ne: new ObjectId(excludeBookingId) };
  }

  const conflict = await bookingsCollection.findOne(filter);
  return conflict;
};

// Trying to full room details inside each booking response by roomId
const roomLookupStages = [
  {
    $addFields: {
      roomObjectId: {
        $convert: {
          input: "$roomId",
          to: "objectId",
          onError: null,
          onNull: null,
        },
      },
    },
  },
  {
    $lookup: {
      from: "rooms",
      localField: "roomObjectId",
      foreignField: "_id",
      as: "room",
    },
  },
  {
    $unwind: {
      path: "$room",
      preserveNullAndEmptyArrays: true,
    },
  },
];
// Main MongoDB connection and server start function, where all the API routes are defined inside the try block to ensure DB connection is established before handling any requests.
async function run() {
  try {
    // await client.connect();

    const db = client.db("silentium");

    const roomsCollection = db.collection("rooms");
    const bookingsCollection = db.collection("bookings");

    // Get all rooms (with search & filters)

    app.get("/rooms", async (req, res) => {
      try {
        const { search, amenities, minRate, maxRate } = req.query;

        // filter object
        const filter = {};

        //  by room name
        if (search && search.trim()) {
          filter.name = { $regex: search.trim(), $options: "i" };
        }

        // amenities
        if (amenities) {
          const amenitiesArray = amenities.split(",");
          filter.amenities = { $in: amenitiesArray };
        }

        // hourly rate range
        if (minRate || maxRate) {
          filter.hourlyRate = {};
          if (minRate) filter.hourlyRate.$gte = Number(minRate);
          if (maxRate) filter.hourlyRate.$lte = Number(maxRate);
        }

        const result = await roomsCollection
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();

        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Failed to fetch rooms",
          error: error.message,
        });
      }
    });

    // GET SINGLE ROOM

    app.get("/rooms/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await roomsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.json({
            success: false,
            message: "Room not found",
          });
        }

        res.json(result);
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to fetch room",
          error,
        });
      }
    });

    // Create new room

    app.post("/rooms", verifyToken, async (req, res) => {
      try {
        const roomDetails = req.body;

        const newRoom = {
          ...roomDetails,
          bookingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await roomsCollection.insertOne(newRoom);

        res.json({
          success: true,
          message: "Room created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to create room",
          error,
        });
      }
    });

    // Get all bookings with room details

    app.get("/bookings", async (req, res) => {
      try {
        const result = await bookingsCollection
          .aggregate([
            ...roomLookupStages,
            {
              $sort: {
                createdAt: -1,
              },
            },
          ])
          .toArray();

        res.json(result);
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to fetch bookings",
          error,
        });
      }
    });

    // Create booking with conflict checking

    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;

        const {
          roomId,
          userId,
          date,
          startTime,
          endTime,
          note,
          totalCost,
          roomName,
          hourlyRate,
          userEmail,
          userName,
          status,
          cancelledAt,
        } = bookingData;

        if (!roomId || !userId || !date || !startTime || !endTime) {
          return res.json({
            success: false,
            message: "Missing required fields",
          });
        }

        const roomObjectId = new ObjectId(roomId);
        const normalizedDate = normalizeDate(date);
        const normalizedStart = normalizeTime(startTime);
        const normalizedEnd = normalizeTime(endTime);

        if (!normalizedDate || !normalizedStart || !normalizedEnd) {
          return res.json({
            success: false,
            message: "Invalid date or time",
          });
        }

        if (normalizedStart >= normalizedEnd) {
          return res.json({
            success: false,
            message: "End time must be after start time",
          });
        }

        const room = await roomsCollection.findOne({
          _id: roomObjectId,
        });

        if (!room) {
          return res.json({
            success: false,
            message: "Room not found",
          });
        }

        const conflict = await findBookingConflict(bookingsCollection, {
          roomId,
          date: normalizedDate,
          startTime: normalizedStart,
          endTime: normalizedEnd,
        });

        if (conflict?.invalid) {
          return res.json({
            success: false,
            message: "Invalid date or time",
          });
        }

        if (conflict) {
          return res.json({
            success: false,
            message: "Room already booked for this time",
          });
        }

        const newBooking = {
          roomId: roomObjectId,
          userId,
          date: normalizedDate,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          note: note || "",
          totalCost,
          roomName: roomName || room.name,
          hourlyRate,
          userEmail,
          userName,
          status: status || "confirmed",
          cancelledAt: cancelledAt ?? null,
          createdAt: new Date(),
        };

        const result = await bookingsCollection.insertOne(newBooking);

        await roomsCollection.updateOne(
          { _id: roomObjectId },
          { $inc: { bookingCount: 1 } },
        );

        res.json({
          success: true,
          message: "Reservation created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to create booking",
          error,
        });
      }
    });

    // My Listings - Single user rooms, without booking details

    app.get("/my-listings/:userId", verifyToken, async (req, res) => {
      try {
        const userId = req.params.userId;

        const result = await roomsCollection
          .find({ creatorId: userId })
          .sort({ createdAt: -1 })
          .toArray();

        res.json(result);
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to fetch listings",
          error,
        });
      }
    });

    // My Booking - Single user bookings, with room details

    app.get("/my-bookings/:userId", verifyToken, async (req, res) => {
      try {
        const userId = req.params.userId;

        if (!userId || userId === "undefined") {
          return res.json([]);
        }

        const result = await bookingsCollection
          .aggregate([
            { $match: { userId } },
            ...roomLookupStages,
            { $sort: { createdAt: -1 } },
          ])
          .toArray();

        res.json(result);
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to fetch bookings",
          error,
        });
      }
    });

    // Update booking + rescheduling

    app.patch("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { date, startTime, endTime, totalCost } = req.body;

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.json({
            success: false,
            message: "Booking not found",
          });
        }

        if (!date || !startTime || !endTime) {
          return res.json({
            success: false,
            message: "Missing required fields",
          });
        }

        const normalizedDate = normalizeDate(date);
        const normalizedStart = normalizeTime(startTime);
        const normalizedEnd = normalizeTime(endTime);

        if (!normalizedDate || !normalizedStart || !normalizedEnd) {
          return res.json({
            success: false,
            message: "Invalid date or time",
          });
        }

        if (normalizedStart >= normalizedEnd) {
          return res.json({
            success: false,
            message: "End time must be after start time",
          });
        }

        const conflict = await findBookingConflict(bookingsCollection, {
          roomId: booking.roomId,
          date: normalizedDate,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          excludeBookingId: id,
        });

        if (conflict?.invalid) {
          return res.json({
            success: false,
            message: "Invalid date or time",
          });
        }

        if (conflict) {
          return res.json({
            success: false,
            message: "Room already booked for this time",
          });
        }

        const wasCancelled =
          booking.status === "cancelled" || booking.status === "canceled";

        await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              date: normalizedDate,
              startTime: normalizedStart,
              endTime: normalizedEnd,
              totalCost,
              status: "confirmed",
              cancelledAt: null,
              updatedAt: new Date(),
            },
          },
        );

        if (wasCancelled) {
          await roomsCollection.updateOne(
            { _id: new ObjectId(booking.roomId) },
            { $inc: { bookingCount: 1 } },
          );
        }

        res.json({
          success: true,
          message: "Booking rescheduled successfully",
        });
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to reschedule booking",
          error,
        });
      }
    });

    // Cancel booking, pathing, and deleting booking

    const cancelBooking = async (req, res) => {
      try {
        const id = req.params.id;

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.json({
            success: false,
            message: "Booking not found",
          });
        }

        if (booking.status === "cancelled") {
          return res.json({
            success: false,
            message: "Booking already cancelled",
          });
        }

        await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "cancelled",
              cancelledAt: new Date(),
            },
          },
        );

        await roomsCollection.updateOne(
          { _id: new ObjectId(booking.roomId) },
          { $inc: { bookingCount: -1 } },
        );

        res.json({
          success: true,
          message: "Booking cancelled successfully",
        });
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to cancel booking",
          error,
        });
      }
    };

    app.patch("/bookings/:id/cancel", cancelBooking);
    app.delete("/bookings/:id", verifyToken, cancelBooking);

    // Updating single room details

    app.put("/rooms/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const result = await roomsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...updatedData,
              updatedAt: new Date(),
            },
          },
        );

        res.json({
          success: true,
          message: "Room updated successfully",
          result,
        });
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to update room",
          error,
        });
      }
    });

    // Deleting rooms with all related bookings

    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const roomObjectId = new ObjectId(id);

        const room = await roomsCollection.findOne({
          _id: roomObjectId,
        });

        if (!room) {
          return res.json({
            success: false,
            message: "Room not found",
          });
        }

        await bookingsCollection.deleteMany({
          $or: [{ roomId: roomObjectId }, { roomId: id }],
        });

        await roomsCollection.deleteOne({
          _id: roomObjectId,
        });

        res.json({
          success: true,
          message: "Room and related bookings deleted successfully",
        });
      } catch (error) {
        res.json({
          success: false,
          message: "Failed to delete room",
          error,
        });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

run().catch(console.dir);
