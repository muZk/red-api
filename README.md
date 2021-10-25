# red.cl API wrapper

A wrapper for Transantiago API to get bus arrival predictions.

## Motivation

At the time of writing, the only public API for transantiago ([scltrans.it](https://scltrans.it)) has a critical endpoint that is not working (next_arrivals).

For example, https://api.scltrans.it/v2/stops/PA10/next_arrivals returns a `{"title": "smsbus webservice timeout"}`.

This project implements next_arrivals using a wrapper over red.cl service.

## How to use

### `GET https://red-api.chewy.workers.dev/stops/:stopId/next_arrivals`

Returns information on upcoming arrivals at the given bus stop. The response format mimics [scltrans's implementation](http://scltrans.it/#/api?id=estimaci%c3%b3n-de-pr%c3%b3ximos-arribos).

Example: To make a prediction for PA10 bus stop, use https://red-api.chewy.workers.dev/stops/PA10/next_arrivals

Example response:

```json
{
  "results": [
    {
      "bus_distance": "479",
      "arrival_estimation": "Llegando.",
      "bus_plate_number": "CJRY-88",
      "route_id": "119",
      "code": "00",
      "message": "",
      "calculated_at": "2021-10-25 11:24",
      "is_live": true
    },
    {
      "bus_distance": "2633",
      "arrival_estimation": "Entre 06 Y 08 min. ",
      "bus_plate_number": "BJFV-75",
      "route_id": "119",
      "code": "00",
      "message": "",
      "calculated_at": "2021-10-25 11:24",
      "is_live": true
    },
    {
      "bus_distance": "2871",
      "arrival_estimation": "Entre 09 Y 13 min. ",
      "bus_plate_number": "CJRX-36",
      "route_id": "345",
      "code": "00",
      "message": "",
      "calculated_at": "2021-10-25 11:24",
      "is_live": true
    }
  ]
}
```

## How it works

The webpage https://www.red.cl/planifica-tu-viaje/cuando-llega/ gets predictions form `https://www.red.cl/predictor/prediccion`. This endpoint works with 3 query params:

1. `t`: authentication token
2. `codsimt`: bus stop ID
3. `codser`: bus ID

If you check the source page, you'll notice that `t` param is a string present in a script tag. Example:

```js
$jwt = 'ZXlKMGVYQWlPaUpLVjFRaUxDSmhiR2NpT2lKSVV6STFOaUo5LmV5SmxlSEFpT2pFMk16VXhOekV6TWpBMU1UQjkuNlJRVkZ3RUgzNm1zMUJFdWw5Q2I3QlhlN21YRkR3eG1RN1hBVzl4SUx1VQ==';
$codsimt = 'PA1';
$codsimt = $codsimt.toUpperCase();
var rutaTheme = 'https://www.red.cl/wp-content/themes/red';
consultaParadero($jwt,$codsimt, desvios);
```

Although it is not used right away. `consultaParadero` decodes it at the beginning of the function:

```js
$jwt_decoded = atob($jwt);
```

All that said, the next_arrivals endpoint was implemented like this:

- Step 1: Get the token from `https://www.red.cl/planifica-tu-viaje/cuando-llega` (run a regex over the HTML source).
- Step 2: Get the data from `https://www.red.cl/predictor/prediccion` passing `t` and  `codsimt`.
- Step 3: Transform the data to make it similar to sclstrans's next_arrivals implementation ([docs](https://scltrans.it/#/readme)).

## Wrangler

This project was generated with [wrangler](https://github.com/cloudflare/wrangler).

Further documentation for Wrangler can be found [here](https://developers.cloudflare.com/workers/tooling/wrangler).
