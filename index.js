import { Router } from 'itty-router'
import { handleCors, wrapCorsHeader } from './cors-helpers'

const router = Router()

const ROUTES = {
  first: '1',
  second: '2',
}

function getRouteInfo(data, key) {
  return {
    bus_distance: data[`distanciabus${key}`],
    arrival_estimation: data[`horaprediccionbus${key}`],
    bus_plate_number: data[`ppubus${key}`],
    route_id: data['servicio'],
    code: data['codigorespuesta'],
    message: data['respuestaServicio'],
  }
}

function singleRouteInfo(data) {
  return [getRouteInfo(data, ROUTES.first)]
}

function multipleRouteInfo(data) {
  return [getRouteInfo(data, ROUTES.first), getRouteInfo(data, ROUTES.second)]
}

function routeFrequencyInfo(data) {
  return [
    {
      bus_distance: null,
      arrival_estimation: data['respuestaServicio'],
      bus_plate_number: null,
      route_id: data['servicio'],
      code: data['codigorespuesta'],
      message: data['respuestaServicio'],
    },
  ]
}

function withoutInfo(data, message) {
  return [
    {
      bus_distance: null,
      arrival_estimation: null,
      bus_plate_number: null,
      route_id: data['servicio'],
      code: data['codigorespuesta'],
      message,
    },
  ]
}

function noRoutesInfo(data) {
  return withoutInfo(data, 'No hay buses que se dirijan al paradero')
}

function closedStopInfo(data) {
  return withoutInfo(
    data,
    'Servicio fuera de horario de operacion para ese paradero',
  )
}

function notAvailableService(data) {
  return withoutInfo(data, 'Servicio no disponible')
}

const RESPONSE_CODES = {
  multipleRoute: '00',
  singleRoute: '01',
  routeFrequency: '9',
  noRoutes: '10',
  closedStop: '11',
  notAvailableService: '12',
}

const SERIALIZER_MAP = {
  '00': multipleRouteInfo,
  '01': singleRouteInfo,
  '9': routeFrequencyInfo,
  '10': noRoutesInfo,
  '11': closedStopInfo,
  '12': notAvailableService,
}

const RESPONSE_PRIORITY = [
  RESPONSE_CODES.multipleRoute,
  RESPONSE_CODES.singleRoute,
  RESPONSE_CODES.routeFrequency,
  RESPONSE_CODES.noRoutes,
  RESPONSE_CODES.closedStop,
  RESPONSE_CODES.notAvailableService,
]

/**
 * Transforms red.cl arrival data to scltrans.it format
 * @param {Object} inputData (red.cl)
 * @returns {Object} (scltrans.it)
 */
function serialize(inputData) {
  const calculatedAt = `${inputData['fechaprediccion']} ${inputData['horaprediccion']}`

  const responseItems = {}

  inputData['servicios']['item'].forEach(serviceItem => {
    const responseCode = serviceItem['codigorespuesta']
    if (SERIALIZER_MAP[responseCode]) {
      const serializer = SERIALIZER_MAP[responseCode]
      if (!responseItems[responseCode]) responseItems[responseCode] = []
      responseItems[responseCode].push(...serializer(serviceItem))
    }
  })

  const results = []
  RESPONSE_PRIORITY.forEach(itemName => {
    const items = responseItems[itemName]
    if (items) {
      items.forEach(item => {
        item['calculated_at'] = calculatedAt
        item['arrival_estimation'] =
          item['arrival_estimation'] || item['message']
        item['is_live'] =
          ['00', '01', '9', '09', '10', '11', '12'].indexOf(item['code']) >= 0
      })
      results.push(...items.filter(item => item['is_live']))
    }
  })

  return {
    results,
  }
}

/**
 * Gets a valid token from red.cl to authenticate API calls
 * @returns Promise<String>
 */
async function getToken() {
  const response = await fetch(
    'https://www.red.cl/planifica-tu-viaje/cuando-llega/',
  )
  const text = await response.text()
  const regex = /\$jwt\s=\s'(.*)'/gm
  let token = null
  let m = null

  while ((m = regex.exec(text)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }

    m.forEach(match => {
      token = match
    })
  }

  return atob(token)
}

/**
 * Get prediction data from red.cl
 * @param {String} token
 * @param {String} stopId
 * @returns Promise<Object>
 */
async function getArrivalData(token, stopId) {
  const response = await fetch(
    `https://www.red.cl/predictor/prediccion?t=${token}&codsimt=${stopId}&codser=`,
  )
  const data = await response.json()
  return serialize(data)
}

router.get('/', () => {
  return new Response('Ok')
})

router.options('/stops/:stopId/next_arrivals', handleCors({ methods: 'POST', maxAge: 86400 }))

router.get('/stops/:stopId/next_arrivals', async ({ params }) => {
  const token = await getToken()
  const data = await getArrivalData(token, params.stopId)
  const response = new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
    },
  })
  return wrapCorsHeader(response)
})

router.all('*', () => new Response('404, not found!', { status: 404 }))

addEventListener('fetch', e => {
  e.respondWith(router.handle(e.request))
})
