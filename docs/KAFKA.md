# Kafka Demo: F1 Telemetry + Datadog Data Streams

The API now exposes a runnable Kafka demo you can start/stop directly from the FastAPI docs. It simulates an F1 telemetry pipeline and is instrumented for Datadog Data Streams Monitoring (DSM).

## Endpoints (Swagger-friendly)
- `POST /api/v1/kafka-demo/start` – launch producer + consumers
- `POST /api/v1/kafka-demo/stop` – stop everything
- `GET /api/v1/kafka-demo/status` – live run status/metrics
- `POST /api/v1/kafka-demo/fault` – update fault profile (latency/drop/dup/slow consumer)

All endpoints are under the **Kafka Demo** tag in `/docs`.

## Topics and Flow
Prefix defaults to `f1` (override with `KAFKA_TOPIC_PREFIX` or per-request).
- `${prefix}.telemetry.raw` – producer publishes synthetic on-car telemetry
- `${prefix}.telemetry.analytics` – analytics consumer enriches/derives degradation score
- `${prefix}.telemetry.alerts` – alerts consumer emits alerts on bad degradation/fault flags

## Environment Variables
Add these to `.env` (see defaults in `env.example`):
- `KAFKA_BOOTSTRAP_SERVERS` (e.g., `localhost:9092`)
- `KAFKA_SECURITY_PROTOCOL` (default `PLAINTEXT`; set `SASL_SSL` or `SASL_PLAINTEXT` if secured)
- `KAFKA_SASL_MECHANISM` (e.g., `PLAIN`, `SCRAM-SHA-512`)  
  `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`
- `KAFKA_SSL_CA_LOCATION` (path to CA bundle when using TLS)
- `KAFKA_TOPIC_PREFIX` (default `f1`)
- `KAFKA_CONSUMER_GROUP` (default `f1-demo`)

### Datadog (Data Streams)
- `DD_DATA_STREAMS_ENABLED=true`
- `DD_AGENT_HOST` / `DD_TRACE_AGENT_PORT` (already used elsewhere)
- Optional tagging: keep `DD_SERVICE` distinct for the Kafka demo (e.g., `fastapi-kafka-demo`)

`ddtrace` is already patched with `kafka=True` in `DatadogProvider`—no extra code changes required beyond the envs above.

## Running Locally
1) Install the Kafka client (already listed in `requirements.txt`):
```bash
pip install confluent-kafka
```
2) Bring up Kafka (any local broker works; a single-node KRaft is fine).  
3) Set `.env` with the Kafka + Datadog vars above.  
4) Start the FastAPI app and use `/docs` to start/stop the demo.

## Request Payloads
`POST /api/v1/kafka-demo/start`
```json
{
  "rate_per_sec": 5,
  "max_messages": 200,
  "scenario": "f1",
  "topic_prefix": "f1",
  "fault": {
    "latency_ms": 0,
    "drop_probability": 0.0,
    "duplicate_ratio": 0.0,
    "slow_consumer_ms": 0
  }
}
```

`POST /api/v1/kafka-demo/fault`
```json
{ "fault": { "latency_ms": 250, "drop_probability": 0.05, "duplicate_ratio": 0.1, "slow_consumer_ms": 500 } }
```

## What the demo does
- **Producer**: emits synthetic F1 telemetry (speed, gear, tire temps, battery SOC, ERS mode, track segment).
- **Analytics consumer**: enriches with degradation score + fault flags; forwards to `.analytics`.
- **Alerts consumer**: raises alerts on high degradation or flagged faults; writes to `.alerts`.
- **Fault switches**: latency injection, random drops, duplicates, and slow consumer pacing.

## Troubleshooting
- Missing client: ensure `confluent-kafka` is installed (arm64 wheels available).
- No data in DSM: verify `DD_DATA_STREAMS_ENABLED=true`, broker reachable from agent, and topics are created/receiving data.
- Auth errors: check `KAFKA_SECURITY_PROTOCOL`, SASL envs, and CA path if TLS is enabled.

## API Spec (Kafka Demo)
Base path: `/api/v1/kafka-demo`

- `POST /start` – Start producer + analytics + alerts.
  - Body:
    ```json
    {
      "bootstrap_servers": "192.168.1.200:9092",  // optional; overrides env
      "rate_per_sec": 5,                          // >0, <=50
      "max_messages": 200,                        // optional; null = no cap
      "scenario": "f1",
      "topic_prefix": "f1",                       // optional; overrides env
      "fault": {
        "latency_ms": 0,
        "drop_probability": 0.0,
        "duplicate_ratio": 0.0,
        "slow_consumer_ms": 0
      }
    }
    ```
  - Response: same shape as `/status` with run_id, topics, metrics, fault, last_error.
  - If already running, returns current status.

- `POST /stop` – Stop all demo tasks.
  - Body: none.
  - Response: `{"running": false, "message": "Kafka demo stopped"}` (idempotent).

- `GET /status` – Current state and counters.
  - Example response:
    ```json
    {
      "running": true,
      "run_id": "uuid",
      "topics": {
        "raw": "f1.telemetry.raw",
        "analytics": "f1.telemetry.analytics",
        "alerts": "f1.telemetry.alerts"
      },
      "bootstrap_servers": "192.168.1.200:9092",
      "metrics": {
        "produced": 123,
        "analytics_consumed": 120,
        "alerts_consumed": 5
      },
      "last_message_at": "2025-12-15T17:16:11.039577",
      "fault": {
        "latency_ms": 0,
        "drop_probability": 0,
        "duplicate_ratio": 0,
        "slow_consumer_ms": 0
      },
      "last_error": null
    }
    ```

- `POST /fault` – Update fault profile live (can be called while running).
  - Body:
    ```json
    {
      "fault": {
        "latency_ms": 250,
        "drop_probability": 0.05,
        "duplicate_ratio": 0.1,
        "slow_consumer_ms": 500
      }
    }
    ```
  - Response: same as `/status` with updated fault values.

Notes:
- Placeholders like `"string"` or empty values for `bootstrap_servers` / `topic_prefix` are ignored and env defaults are used.
- Required envs if not provided in the request: `KAFKA_BOOTSTRAP_SERVERS` (plus optional `KAFKA_TOPIC_PREFIX`, `KAFKA_CONSUMER_GROUP`, SASL/TLS settings).
