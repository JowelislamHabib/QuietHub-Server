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

const normalizeBaseUrl = (value) => String(value || "").replace(/\/+$/, "");
const PIPRAPAY_BASE_URL = normalizeBaseUrl(
  process.env.PIPRAPAY_ENDPOINT ||
    process.env.PIPRAPAY_BASE_URL ||
    "https://sandbox.piprapay.com",
);
const PIPRAPAY_API_KEY = process.env.PIPRAPAY_API_KEY;
const PIPRAPAY_CHECKOUT_REDIRECT_URL =
  process.env.PIPRAPAY_CHECKOUT_REDIRECT_URL;
const PIPRAPAY_VERIFY_PAYMENT_URL = process.env.PIPRAPAY_VERIFY_PAYMENT_URL;
const PIPRAPAY_REFUND_URL = process.env.PIPRAPAY_REFUND_URL;
const buildPipraPayUrl = ({ path, fullUrl }) => {
  if (fullUrl) {
    return fullUrl;
  }
  return `${PIPRAPAY_BASE_URL}${path}`;
};
const normalizePipraPayId = (ppId) => String(ppId ?? "").trim();
const buildPipraPayIdFilter = (ppId) => {
  const normalizedId = normalizePipraPayId(ppId);
  const numericId = Number(normalizedId);

  if (!normalizedId) {
    return { pp_id: null };
  }

  if (!Number.isNaN(numericId)) {
    return {
      $or: [{ pp_id: normalizedId }, { pp_id: numericId }],
    };
  }

  return { pp_id: normalizedId };
};
const parseStatusFromPipraPayPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }
  return (
    payload.status ||
    payload.payment_status ||
    payload.transaction_status ||
    "unknown"
  );
};
const parsePaymentState = (payload) => {
  const raw = String(parseStatusFromPipraPayPayload(payload)).toLowerCase();
  if (["completed", "success", "succeeded", "paid"].includes(raw)) {
    return "completed";
  }
  if (
    [
      "cancelled",
      "canceled",
      "failed",
      "rejected",
      "declined",
      "expired",
    ].includes(raw)
  ) {
    return "cancelled";
  }
  if (["pending", "processing"].includes(raw)) {
    return "pending";
  }
  return "unknown";
};
const syncBookingStatusFromPayment = async (
  bookingsCollection,
  ppId,
  paymentPayload,
) => {
  const normalizedPpId = normalizePipraPayId(ppId);
  if (!normalizedPpId) return;

  const paymentState = parsePaymentState(paymentPayload);
  let bookingStatus = "pending";
  if (paymentState === "completed") {
    bookingStatus = "confirmed";
  } else if (paymentState === "cancelled") {
    bookingStatus = "cancelled";
  }

  await bookingsCollection.updateOne(
    { paymentPpId: normalizedPpId },
    {
      $set: {
        paymentStatus: paymentState,
        status: bookingStatus,
        paymentVerifiedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
};
const getErrorDetails = (error) => ({
  message: error?.message || "Unknown error",
  code: error?.cause?.code || null,
});
const resolveVerifyUrls = () => {
  const urls = [];
  if (PIPRAPAY_VERIFY_PAYMENT_URL) {
    urls.push(PIPRAPAY_VERIFY_PAYMENT_URL);
  }
  urls.push(`${PIPRAPAY_BASE_URL}/api/verify-payment`);
  urls.push(`${PIPRAPAY_BASE_URL}/api/verify-payments`);
  return [...new Set(urls)];
};

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
    // console.log(payload);
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
    const paymentsCollection = db.collection("payments");

    // Shared requester for PipraPay APIs
    const pipraPayRequest = async ({ path, fullUrl, payload }) => {
      const response = await fetch(buildPipraPayUrl({ path, fullUrl }), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mh-piprapay-api-key": PIPRAPAY_API_KEY,
          "MHS-PIPRAPAY-API-KEY": PIPRAPAY_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const rawBody = await response.text();
      let responseBody = null;
      try {
        responseBody = rawBody ? JSON.parse(rawBody) : null;
      } catch (error) {
        responseBody = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        responseBody,
        rawBody,
        contentType: response.headers.get("content-type"),
      };
    };
    const verifyPipraPayPayment = async (ppId) => {
      const normalizedPpId = normalizePipraPayId(ppId);
      const verifyUrls = resolveVerifyUrls();
      let verifyResult = null;

      for (const verifyUrl of verifyUrls) {
        const currentResult = await pipraPayRequest({
          path: "/api/verify-payment",
          fullUrl: verifyUrl,
          payload: { pp_id: normalizedPpId },
        });
        verifyResult = currentResult;
        if (currentResult.ok) {
          break;
        }
      }

      return { normalizedPpId, verifyResult };
    };

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

    app.get("/bookings", verifyToken, async (req, res) => {
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

        // Auto-sync pending payments in case webhook was not delivered.
        const pendingPaymentBookings = await bookingsCollection
          .find(
            {
              userId,
              status: "pending",
              paymentPpId: { $exists: true, $ne: null },
            },
            { projection: { paymentPpId: 1 } },
          )
          .toArray();

        for (const booking of pendingPaymentBookings) {
          const { normalizedPpId, verifyResult } = await verifyPipraPayPayment(
            booking.paymentPpId,
          );
          if (verifyResult?.ok) {
            await paymentsCollection.updateOne(
              buildPipraPayIdFilter(normalizedPpId),
              {
                $set: {
                  provider: "piprapay",
                  pp_id: normalizedPpId,
                  verificationPayload: verifyResult.responseBody,
                  status: verifyResult.responseBody?.status || "unknown",
                  updatedAt: new Date(),
                },
                $setOnInsert: {
                  createdAt: new Date(),
                },
              },
              { upsert: true },
            );
            await syncBookingStatusFromPayment(
              bookingsCollection,
              normalizedPpId,
              verifyResult.responseBody,
            );
          }
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

        const paymentStatus = String(booking.paymentStatus || "").toLowerCase();
        if (paymentStatus && paymentStatus !== "completed") {
          return res.json({
            success: false,
            message:
              "Reschedule allowed only for bookings with completed payment status",
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

    // Create PipraPay charge for checkout
    app.post("/payments/piprapay/create-charge", async (req, res) => {
      try {
        if (!PIPRAPAY_API_KEY) {
          return res.status(500).json({
            success: false,
            message: "PIPRAPAY_API_KEY missing in server env",
          });
        }

        const {
          full_name,
          email_mobile,
          email_address,
          mobile_number,
          amount,
          metadata = {},
          redirect_url,
          return_type = "GET",
          cancel_url,
          webhook_url,
          currency =
            process.env.PIPRAPAY_DEFAULT_CURRENCY ||
            process.env.NEXT_PUBLIC_CURRENCY ||
            "USD",
        } = req.body;

        const contact = email_mobile || email_address || mobile_number;
        if (!full_name || !contact || !amount) {
          return res.status(400).json({
            success: false,
            message:
              "full_name, amount and one contact field (email_mobile/email_address/mobile_number) are required",
          });
        }

        const requestOrigin = `${req.protocol}://${req.get("host")}`;
        const callbackUrl =
          process.env.PIPRAPAY_CALLBACK_URL ||
          `${requestOrigin}/payments/piprapay/callback`;
        const frontendRedirectUrl =
          redirect_url ||
          process.env.PIPRAPAY_REDIRECT_URL ||
          process.env.CLIENT_URL;

        const payload = {
          full_name,
          email_mobile: email_mobile || email_address || mobile_number,
          email_address: email_address || email_mobile,
          mobile_number: mobile_number || email_mobile,
          amount: String(amount),
          metadata,
          // Some PipraPay endpoints use redirect_url and others use return_url.
          // We always return through backend callback so pp_id is captured reliably.
          redirect_url: callbackUrl,
          return_url: callbackUrl,
          return_type,
          cancel_url:
            cancel_url ||
            process.env.PIPRAPAY_CANCEL_URL ||
            frontendRedirectUrl,
          webhook_url:
            webhook_url ||
            process.env.PIPRAPAY_WEBHOOK_URL ||
            process.env.SERVER_URL,
          currency,
        };

        const { ok, status, responseBody, rawBody, contentType } =
          await pipraPayRequest({
            path: "/api/create-charge",
            fullUrl: PIPRAPAY_CHECKOUT_REDIRECT_URL,
            payload,
          });

        if (!ok) {
          return res.status(status || 400).json({
            success: false,
            message: "Failed to create PipraPay charge",
            piprapay: responseBody,
            piprapay_raw: rawBody,
            piprapay_content_type: contentType,
          });
        }

        const normalizedPpId = normalizePipraPayId(responseBody?.pp_id);
        const bookingData = metadata?.booking;

        if (
          bookingData &&
          bookingData.roomId &&
          bookingData.userId &&
          bookingData.date &&
          bookingData.startTime &&
          bookingData.endTime &&
          normalizedPpId
        ) {
          const normalizedDate = normalizeDate(bookingData.date);
          const normalizedStart = normalizeTime(bookingData.startTime);
          const normalizedEnd = normalizeTime(bookingData.endTime);
          const roomIdValue = String(bookingData.roomId);
          let roomIdForInsert = roomIdValue;

          try {
            roomIdForInsert = new ObjectId(roomIdValue);
          } catch (error) {
            roomIdForInsert = roomIdValue;
          }

          await bookingsCollection.updateOne(
            { paymentPpId: normalizedPpId },
            {
              $setOnInsert: {
                roomId: roomIdForInsert,
                userId: bookingData.userId,
                date: normalizedDate,
                startTime: normalizedStart,
                endTime: normalizedEnd,
                note: bookingData.note || "",
                totalCost: bookingData.totalCost,
                roomName: bookingData.roomName,
                hourlyRate: bookingData.hourlyRate,
                userEmail: bookingData.userEmail,
                userName: bookingData.userName,
                status: "pending",
                paymentProvider: "piprapay",
                paymentPpId: normalizedPpId,
                paymentStatus: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          );
        }

        await paymentsCollection.insertOne({
          provider: "piprapay",
          pp_id: normalizedPpId,
          amount: String(amount),
          currency,
          metadata,
          status: "pending",
          requestPayload: payload,
          responsePayload: responseBody,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        res.json({
          success: true,
          message: "Charge created successfully",
          data: responseBody,
        });
      } catch (error) {
        const errorDetails = getErrorDetails(error);
        res.status(500).json({
          success: false,
          message: "Failed to create charge",
          error: errorDetails.message,
          code: errorDetails.code,
        });
      }
    });

    // Verify PipraPay transaction status
    app.post("/payments/piprapay/verify", async (req, res) => {
      try {
        if (!PIPRAPAY_API_KEY) {
          return res.status(500).json({
            success: false,
            message: "PIPRAPAY_API_KEY missing in server env",
          });
        }

        const { pp_id } = req.body;
        if (!pp_id) {
          return res.status(400).json({
            success: false,
            message: "pp_id is required",
          });
        }

        const { normalizedPpId, verifyResult } = await verifyPipraPayPayment(
          pp_id,
        );

        const { ok, status, responseBody, rawBody, contentType } = verifyResult;

        if (!ok) {
          return res.status(status || 400).json({
            success: false,
            message: "Failed to verify payment",
            piprapay: responseBody,
            piprapay_raw: rawBody,
            piprapay_content_type: contentType,
          });
        }

        await paymentsCollection.updateOne(
          buildPipraPayIdFilter(normalizedPpId),
          {
            $set: {
              provider: "piprapay",
              pp_id: normalizedPpId,
              verificationPayload: responseBody,
              status: responseBody?.status || "unknown",
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );

        await syncBookingStatusFromPayment(
          bookingsCollection,
          normalizedPpId,
          responseBody,
        );

        res.json({
          success: true,
          message: "Payment verified successfully",
          data: responseBody,
        });
      } catch (error) {
        const errorDetails = getErrorDetails(error);
        res.status(500).json({
          success: false,
          message: "Failed to verify payment",
          error: errorDetails.message,
          code: errorDetails.code,
        });
      }
    });

    // Redirect callback: auto-verify pp_id and forward to frontend
    app.all("/payments/piprapay/callback", async (req, res) => {
      try {
        if (!PIPRAPAY_API_KEY) {
          return res.status(500).json({
            success: false,
            message: "PIPRAPAY_API_KEY missing in server env",
          });
        }

        const callbackPpId =
          req.body?.pp_id ||
          req.query?.pp_id ||
          req.body?.invoice_id ||
          req.query?.invoice_id ||
          req.body?.transaction_ref ||
          req.query?.transaction_ref ||
          req.body?.ppid ||
          req.query?.ppid;
        const normalizedPpId = normalizePipraPayId(callbackPpId);

        if (!normalizedPpId) {
          return res.status(400).json({
            success: false,
            message: "pp_id is required in callback",
          });
        }

        const { verifyResult } = await verifyPipraPayPayment(normalizedPpId);

        const { ok, responseBody } = verifyResult;

        const callbackStatus =
          req.body?.pp_status ||
          req.query?.pp_status ||
          req.body?.status ||
          req.query?.status;
        const finalStatus = ok
          ? parseStatusFromPipraPayPayload(responseBody)
          : callbackStatus || "verify_failed";

        await paymentsCollection.updateOne(
          buildPipraPayIdFilter(normalizedPpId),
          {
            $set: {
              provider: "piprapay",
              pp_id: normalizedPpId,
              callbackPayload: {
                body: req.body,
                query: req.query,
              },
              verificationPayload: responseBody,
              status: finalStatus,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );

        await syncBookingStatusFromPayment(bookingsCollection, normalizedPpId, {
          status: finalStatus,
        });

        const successBase =
          process.env.PIPRAPAY_REDIRECT_URL || process.env.CLIENT_URL || "/";
        const separator = successBase.includes("?") ? "&" : "?";
        const redirectUrl =
          `${successBase}${separator}` +
          `pp_id=${encodeURIComponent(normalizedPpId)}` +
          `&status=${encodeURIComponent(finalStatus)}`;

        return res.redirect(302, redirectUrl);
      } catch (error) {
        const errorDetails = getErrorDetails(error);
        return res.status(500).json({
          success: false,
          message: "Failed to process callback",
          error: errorDetails.message,
          code: errorDetails.code,
        });
      }
    });

    // Receive and validate PipraPay webhook events
    app.post("/payments/piprapay/webhook", async (req, res) => {
      try {
        if (!PIPRAPAY_API_KEY) {
          return res.status(500).json({
            success: false,
            message: "PIPRAPAY_API_KEY missing in server env",
          });
        }

        const receivedApiKey =
          req.headers["mh-piprapay-api-key"] ||
          req.headers["Mh-Piprapay-Api-Key"] ||
          req.headers["mhs-piprapay-api-key"];

        if (receivedApiKey !== PIPRAPAY_API_KEY) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized webhook request",
          });
        }

        const webhookPayload = req.body || {};
        const ppId = normalizePipraPayId(webhookPayload.pp_id);
        console.log("[piprapay-webhook] received", {
          ppId,
          status: webhookPayload?.status,
        });

        await paymentsCollection.updateOne(
          buildPipraPayIdFilter(ppId),
          {
            $set: {
              provider: "piprapay",
              pp_id: ppId,
              webhookPayload,
              status: webhookPayload.status || "unknown",
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );

        await syncBookingStatusFromPayment(bookingsCollection, ppId, webhookPayload);

        // If dashboard update webhook does not contain final status,
        // force-refresh by hitting verify endpoint.
        const webhookStatus = parsePaymentState(webhookPayload);
        if (!webhookStatus || webhookStatus === "unknown" || webhookStatus === "pending") {
          const { verifyResult } = await verifyPipraPayPayment(ppId);
          if (verifyResult?.ok) {
            await paymentsCollection.updateOne(
              buildPipraPayIdFilter(ppId),
              {
                $set: {
                  verificationPayload: verifyResult.responseBody,
                  status: verifyResult.responseBody?.status || "unknown",
                  updatedAt: new Date(),
                },
              },
            );
            await syncBookingStatusFromPayment(
              bookingsCollection,
              ppId,
              verifyResult.responseBody,
            );
          }
        }

        res.status(200).json({
          success: true,
          message: "Webhook received",
        });
      } catch (error) {
        const errorDetails = getErrorDetails(error);
        res.status(500).json({
          success: false,
          message: "Failed to process webhook",
          error: errorDetails.message,
          code: errorDetails.code,
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
