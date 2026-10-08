# Enrich company in Clay with looot

Adds a column that runs looot's `company.enrich` job for each row.

![Illustration of the HTTP API column settings, not a Clay screenshot](../illustrations/enrich-company.png)

*Illustration made for this repo. It is not a screenshot of Clay.*

## Cost per row

Priced on 2026-10-08 from the public catalog (`GET https://api.looot.ai/v1/catalog/overview?depth=jobs`):

| | |
|---|---|
| Cheapest provider, per call | $0.0019 |
| Cheapest provider billed per result | $0.00145 |
| Providers looot can try | 21 |
| Cap in this recipe (`fallback.maxCostUsd`) | $0.02 per row |

A row costs the price of the providers that ran. With fallback on, looot moves to the next provider when
one finds nothing, so a hard row can cost more than the cheapest price, never more than the cap. A failed
call costs nothing. Each row's real cost comes back in `actualCost`. Clay may also charge its own
credits for an HTTP API column; Clay's HTTP API page does not state a number, so check your plan.

## Columns your table needs

- `Company Domain`

Rename the `/Column Name` references in the body if your columns have other names.

## Settings

In your table: Add column, Add enrichment, HTTP API.

| Field | Value |
|---|---|
| Method | `POST` |
| API endpoint URL | `https://api.looot.ai/v1/runs` |
| Query string parameters | `wait` = `20` |
| Select header account | `looot` (see [the README](../README.md#1-save-your-looot-token-once)) |
| Field paths to return | `normalized.fields.name`, `normalized.fields.industry`, `normalized.fields.size`, `status`, `actualCost`, `runId` |
| Remove empty fields from request | On |
| Rate limiting | Request limit `5`, Duration (ms) `1000` |
| Only run if | Company Domain is not empty |

JSON body, also in [`enrich-company.body.json`](enrich-company.body.json):

```json
{
  "endpointId": "job:company.enrich",
  "input": {
    "domain": "/Company Domain"
  },
  "idempotencyKey": "clay-enrich-company-/Company Domain",
  "fallback": {
    "enabled": true,
    "maxCostUsd": 0.02
  }
}
```

## Map the answer to columns

| New column | Field path |
|---|---|
| Company Name | `normalized.fields.name` |
| Industry | `normalized.fields.industry` |
| Company Size | `normalized.fields.size` |
| looot Cost | `actualCost` |

## Notes

- The fixed fields are `name`, `domain`, `industry` and `size`. Everything else the provider returned is under `result`; add `result` to the field paths to see it.
- No domain? Use `"name": "/Company Name"` in place of the domain line.
- The `idempotencyKey` is built from the row's own values. Running the same row again returns the first
  run and costs nothing. To force a fresh lookup, change the prefix, for example add `-v2`.
