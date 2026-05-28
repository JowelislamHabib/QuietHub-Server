Create Charge

# Create Charge

> 📘 Introduction
>
> The PipraPay Create Charge API allows you to initiate a payment. After a successful payment, an invoice_id will be sent via GET or POST request to your specified pp_url. To obtain payment data, you'll need to call the Verify Payment API.

# OpenAPI definition

```json
{
  "openapi": "3.0.0",
  "info": {
    "version": "1.0.0",
    "title": "Sandbox"
  },
  "servers": [
    {
      "url": "https://sandbox.piprapay.com"
    }
  ],
  "paths": {
    "/api/create-charge": {
      "post": {
        "summary": "New Endpoint",
        "description": "This is your first endpoint! Edit this page to start documenting your API.",
        "operationId": "get_new-endpoint",
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "examples": {
                  "LOG": {
                    "summary": "LOG",
                    "value": {
                      "status": true,
                      "pp_id": 181055228,
                      "pp_url": "https://sandbox.piprapay.com/payment/181055228"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "examples": {
                  "LOG": {
                    "value": {
                      "status": false,
                      "message": "Invalid Metadata Format"
                    },
                    "summary": "LOG"
                  }
                }
              }
            }
          }
        },
        "security": [
          {
            "ApiKeyAuth": []
          }
        ],
        "parameters": [],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "full_name": {
                    "type": "string",
                    "description": "User's full name.",
                    "default": "Demo"
                  },
                  "email_mobile": {
                    "type": "string",
                    "description": "User's email address or mobile number.",
                    "default": "demo@gmail.com"
                  },
                  "amount": {
                    "type": "string",
                    "description": "The payment amount.",
                    "default": "10"
                  },
                  "metadata": {
                    "type": "object",
                    "description": "Additional project-specific data in JSON format. For example: { \"product_id\": \"5\"}",
                    "properties": {
                      "invoiceid": {
                        "type": "string",
                        "default": "7457457445",
                        "description": "You can pass anything"
                      }
                    }
                  },
                  "redirect_url": {
                    "type": "string",
                    "description": "The URL where the user will be redirected after a successful payment. Additionally, an pp_id will be sent via POST data, which you must validate using the Verify Payment API.",
                    "default": "https://piprapay.com"
                  },
                  "return_type": {
                    "type": "string",
                    "description": "Specifies how the invoice_id is returned to the success page. It can be either \"GET\" or \"POST.\"",
                    "default": "GET"
                  },
                  "cancel_url": {
                    "type": "string",
                    "description": "The URL where the user will be redirected when they click the cancel button during the payment process.",
                    "default": "https://piprapay.com"
                  },
                  "webhook_url": {
                    "type": "string",
                    "description": "A backend response URL where payment information is sent when an admin initiates a \"SEND WEBHOOK REQUEST\" from the admin panel.",
                    "default": "https://piprapay.com"
                  },
                  "currency": {
                    "type": "string",
                    "default": "BDT",
                    "description": "The currency selected for payment processing"
                  }
                },
                "type": "object",
                "required": [
                  "full_name",
                  "email_mobile",
                  "amount",
                  "metadata",
                  "redirect_url",
                  "cancel_url",
                  "return_type",
                  "webhook_url",
                  "currency"
                ]
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "mh-piprapay-api-key"
      }
    }
  }
}
```

Verify Payment

# Verify Payment

# OpenAPI definition

```json
{
  "openapi": "3.0.0",
  "info": {
    "version": "1.0.0",
    "title": "Sandbox"
  },
  "servers": [
    {
      "url": "https://sandbox.piprapay.com"
    }
  ],
  "paths": {
    "/api/verify-payments": {
      "post": {
        "description": "",
        "operationId": "post_new-endpoint",
        "responses": {
          "200": {
            "description": "",
            "content": {
              "application/json": {
                "examples": {
                  "LOG": {
                    "summary": "LOG",
                    "value": {
                      "pp_id": "181055228",
                      "customer_name": "Demo",
                      "customer_email_mobile": "demo@gmail.com",
                      "payment_method": "bKash Personal",
                      "amount": "10",
                      "fee": "0",
                      "refund_amount": "0",
                      "total": 10,
                      "currency": "BDT",
                      "metadata": {
                        "invoiceid": "uouyo"
                      },
                      "sender_number": "568568568",
                      "transaction_id": "io[io[o",
                      "status": "completed",
                      "date": "2025-06-26 13:34:13"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "examples": {
                  "LOG": {
                    "value": {
                      "status": false,
                      "message": "Invalid Transaction"
                    },
                    "summary": "LOG"
                  }
                }
              }
            }
          }
        },
        "parameters": [],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "pp_id": {
                    "type": "string",
                    "description": "Payment ID"
                  }
                },
                "type": "object",
                "required": ["pp_id"]
              }
            }
          }
        },
        "security": [
          {
            "ApiKeyAuth": []
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "mh-piprapay-api-key"
      }
    }
  }
}
```

Validate Webhook

# Validate Webhook

> ❗️ Note
>
> Ensure that you include the webhook URL in the 'webhook_url' parameter when making a request to the Create Charge API.

<br />

```php PHP
<?php
  $rawData = file_get_contents("php://input");
  $data = json_decode($rawData, true);

  $headers = getallheaders();

  $received_api_key = '';

  if (isset($headers['mh-piprapay-api-key'])) {
      $received_api_key = $headers['mh-piprapay-api-key'];
  } elseif (isset($headers['Mh-Piprapay-Api-Key'])) {
      $received_api_key = $headers['Mh-Piprapay-Api-Key'];
  } elseif (isset($_SERVER['HTTP_MH_PIPRAPAY_API_KEY'])) {
      $received_api_key = $_SERVER['HTTP_MH_PIPRAPAY_API_KEY']; // fallback if needed
  }

  if ($received_api_key !== "YOUR_API") {
      status_header(401);
      echo json_encode(["status" => false, "message" => "Unauthorized request."]);
      exit;
  }

  $pp_id = $data['pp_id'] ?? '';
  $customer_name = $data['customer_name'] ?? '';
  $customer_email_mobile = $data['customer_email_mobile'] ?? '';
  $payment_method = $data['payment_method'] ?? '';
  $amount = $data['amount'] ?? 0;
  $fee = $data['fee'] ?? 0;
  $refund_amount = $data['refund_amount'] ?? 0;
  $total = $data['total'] ?? 0;
  $currency = $data['currency'] ?? '';
  $status = $data['status'] ?? '';
  $date = $data['date'] ?? '';

  $metadata = $data['metadata'] ?? [];

  http_response_code(200);
  echo json_encode(['status' => true, 'message' => 'Webhook received']);
```

<br />

```json JSON
{
  "pp_id": "181055228",
  "customer_name": "Demo",
  "customer_email_mobile": "demo@gmail.com",
  "payment_method": "bKash Personal",
  "amount": "10",
  "fee": "0",
  "refund_amount": "0",
  "total": 10,
  "currency": "BDT",
  "metadata": {
    "invoiceid": "uouyo"
  },
  "sender_number": "568568568",
  "transaction_id": "io[io[o",
  "status": "completed",
  "date": "2025-06-26 13:34:13"
}
```

Redirect checkout

# Redirect checkout

# OpenAPI definition

```json
{
  "openapi": "3.0.0",
  "info": {
    "version": "1.0.0",
    "title": "Sandbox"
  },
  "servers": [
    {
      "url": "https://sandbox.piprapay.com"
    }
  ],
  "paths": {
    "/api/checkout/redirect": {
      "post": {
        "description": "",
        "responses": {
          "200": {
            "description": "",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string"
                    }
                  },
                  "required": ["name"]
                },
                "examples": {
                  "OK": {
                    "summary": "OK",
                    "value": {
                      "pp_id": "349452200706799329851862826",
                      "pp_url": "https://pay.demo.com/checkout/2134123412341234231"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {}
                },
                "examples": {
                  "Bad Request": {
                    "summary": "Bad Request",
                    "value": {
                      "error": {
                        "code": "INVALID_API_KEY",
                        "message": "The API key provided is incorrect or invalid."
                      }
                    }
                  }
                }
              }
            },
            "description": "Bad Request"
          }
        },
        "parameters": [
          {
            "in": "header",
            "name": "MHS-PIPRAPAY-API-KEY",
            "schema": {
              "type": "string"
            },
            "required": true,
            "description": "API Key\n\n"
          }
        ],
        "operationId": "post_api-checkout-redirect",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "full_name": {
                    "type": "string",
                    "description": "User's full name.\n\n"
                  },
                  "email_address": {
                    "type": "string",
                    "description": "User's email address.\n\n"
                  },
                  "mobile_number": {
                    "type": "string",
                    "description": "User's mobile number.\n\n"
                  },
                  "amount": {
                    "type": "string",
                    "description": "The payment amount.\n\n"
                  },
                  "currency": {
                    "type": "string",
                    "description": "The payment currency. For example: BDT, USD, INR\n\n"
                  },
                  "metadata": {
                    "type": "string",
                    "description": "Additional project-specific data in JSON format. For example: { \"order_id\": \"1\", \"product_id\": \"1\"}\n\n"
                  },
                  "return_url": {
                    "type": "string",
                    "description": "The URL where the user will be redirected from checkout.\n\n"
                  },
                  "webhook_url": {
                    "type": "string",
                    "description": "A backend response URL where payment information is sent when an admin initiates a \"SEND WEBHOOK REQUEST\" from the admin panel.\n\n"
                  }
                },
                "required": [
                  "full_name",
                  "webhook_url",
                  "return_url",
                  "metadata",
                  "currency",
                  "amount",
                  "mobile_number",
                  "email_address"
                ]
              }
            }
          }
        }
      }
    }
  }
}
```

Verify Payment

# Verify Payment

# OpenAPI definition

```json
{
  "openapi": "3.0.0",
  "info": {
    "version": "1.0.0",
    "title": "Sandbox"
  },
  "servers": [
    {
      "url": "https://sandbox.piprapay.com"
    }
  ],
  "paths": {
    "/api/verify-payment?": {
      "post": {
        "description": "",
        "responses": {
          "200": {
            "description": "",
            "content": {
              "application/json": {
                "examples": {
                  "OK": {
                    "summary": "OK",
                    "value": {
                      "pp_id": "349452200706799329851862826",
                      "full_name": "Rasel Islam",
                      "email_address": "robiul@gmail.com",
                      "mobile_number": "01300000000",
                      "gateway": "Bkash Personal",
                      "amount": "6",
                      "fee": "0.68",
                      "discount_amount": "0.34",
                      "total": 6.34,
                      "local_net_amount": "774.99",
                      "currency": "USD",
                      "local_currency": "BDT",
                      "metadata": {
                        "invoice_id": "518917606497522107418488315457"
                      },
                      "sender": "01300000000",
                      "transaction_id": "LSKDJCVNNVHG",
                      "status": "completed",
                      "date": "Jan 30, 2026 07:01 PM"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {}
                },
                "examples": {
                  "Bad Request": {
                    "summary": "Bad Request",
                    "value": {
                      "error": {
                        "code": "INVALID_API_KEY",
                        "message": "The API key provided is incorrect or invalid."
                      }
                    }
                  }
                }
              }
            },
            "description": "Bad Request"
          }
        },
        "parameters": [
          {
            "in": "header",
            "name": "MHS-PIPRAPAY-API-KEY",
            "schema": {
              "type": "string"
            },
            "description": "API Key\n",
            "required": true
          }
        ],
        "operationId": "post_api-verify-payment",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "pp_id": {
                    "type": "string",
                    "description": "Transaction ID\n\n"
                  }
                },
                "required": ["pp_id"]
              }
            }
          }
        }
      }
    }
  }
}
```

Refund Payment

# Refund Payment

# OpenAPI definition

```json
{
  "openapi": "3.0.0",
  "info": {
    "version": "1.0.0",
    "title": "Sandbox"
  },
  "servers": [
    {
      "url": "https://sandbox.piprapay.com"
    }
  ],
  "paths": {
    "/api/refund-payment": {
      "post": {
        "description": "",
        "responses": {
          "200": {
            "description": "",
            "content": {
              "application/json": {
                "examples": {
                  "OK": {
                    "summary": "OK",
                    "value": {
                      "pp_id": "349452200706799329851862826",
                      "full_name": "Rasel Islam",
                      "email_address": "robiul@gmail.com",
                      "mobile_number": "01300000000",
                      "gateway": "Bkash Personal",
                      "amount": "6",
                      "fee": "0.68",
                      "discount_amount": "0.34",
                      "total": 6.34,
                      "local_net_amount": "774.99",
                      "currency": "USD",
                      "local_currency": "BDT",
                      "metadata": {
                        "invoice_id": "518917606497522107418488315457"
                      },
                      "sender": "01300000000",
                      "transaction_id": "LSKDJCVNNVHG",
                      "status": "completed",
                      "date": "Jan 30, 2026 07:01 PM"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {}
                },
                "examples": {
                  "Bad Request": {
                    "summary": "Bad Request",
                    "value": {
                      "pp_id": "349452200706799329851862826",
                      "full_name": "Rasel Islam",
                      "email_address": "robiul@gmail.com",
                      "mobile_number": "01300000000",
                      "gateway": "Bkash Personal",
                      "amount": "6",
                      "fee": "0.68",
                      "discount_amount": "0.34",
                      "total": 6.34,
                      "local_net_amount": "774.99",
                      "currency": "USD",
                      "local_currency": "BDT",
                      "metadata": {
                        "invoice_id": "518917606497522107418488315457"
                      },
                      "sender": "01300000000",
                      "transaction_id": "LSKDJCVNNVHG",
                      "status": "completed",
                      "date": "Jan 30, 2026 07:01 PM"
                    }
                  }
                }
              }
            },
            "description": "Bad Request"
          }
        },
        "parameters": [
          {
            "in": "header",
            "name": "MHS-PIPRAPAY-API-KEY",
            "schema": {
              "type": "string"
            },
            "required": true
          }
        ],
        "operationId": "post_api-refund-payment",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "pp_id": {
                    "type": "string"
                  }
                },
                "required": ["pp_id"]
              }
            }
          }
        }
      }
    }
  }
}
```

Webhook Guides

# Webhook Guides

PipraPay sends real-time updates about payment status through webhooks. Integrate this API to automatically process payments, refunds, and transaction events.

## &#x20;Headers Info

| Header Name   | Value            |
| :------------ | :--------------- |
| Method:       | POST             |
| Content-Type: | application/json |

## Request Payload

The webhook sends a JSON payload for each transaction. Here's a sample payload:

```json
{
  "pp_id": "349452200706799329851862826",
  "full_name": "Rasel Islam",
  "email_address": "robiul@gmail.com",
  "mobile_number": "01300000000",
  "gateway": "Bkash Personal",
  "amount": "6",
  "fee": "0.68",
  "discount_amount": "0.34",
  "total": 6.34,
  "local_net_amount": "774.99",
  "currency": "USD",
  "local_currency": "BDT",
  "metadata": {
    "invoice_id": "518917606497522107418488315457"
  },
  "sender": "01300000000",
  "transaction_id": "LSKDJCVNNVHG",
  "status": "completed",
  "date": "Jan 30, 2026 07:01 PM"
}
```

## Handling Webhook

Here’s a simple PHP example to handle the BillPax webhook:

```php
<?php
  $data = json_decode(file_get_contents('php://input'), true);

  http_response_code(200);

  if ($data) {
      $status = $data['status'] ?? 'unknown';
      $pp_id = $data['pp_id'] ?? null;

      echo json_encode(['status' => 'ok']);
  } else {
      echo json_encode(['status' => 'error', 'message' => 'Invalid payload']);
  }
```

## HTTP Response Code

| Code | Description                   |
| :--- | :---------------------------- |
| 200  | Webhook received successfully |
