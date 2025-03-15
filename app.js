const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const InitializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

InitializeDbAndServer()

//Login API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}';`
  const getUserResponse = await db.get(getUserQuery)

  if (getUserResponse === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const passwordMatched = await bcrypt.compare(
      password,
      getUserResponse.password,
    )
    if (passwordMatched !== true) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken: jwtToken})
    }
  }
})

//Authentication with Token
const AuthenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        console.log('Authorized User')
        next()
      }
    })
  }
}

//API 2
app.get('/states/', AuthenticateToken, async (request, response) => {
  const getAllStatesQuery = `
  SELECT *
  FROM state;`
  const statesArray = await db.all(getAllStatesQuery)
  response.send(
    statesArray.map(eachState => ({
      stateId: eachState.state_id,
      stateName: eachState.state_name,
      population: eachState.population,
    })),
  )
})

//API 3
app.get('/states/:stateId/', AuthenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT *
  FROM state
  WHERE state_id = ${stateId};`
  const stateResponse = await db.get(getStateQuery)
  response.send({
    stateId: stateResponse.state_id,
    stateName: stateResponse.state_name,
    population: stateResponse.population,
  })
})

//API 4
app.post('/districts/', AuthenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDistrictQuery = `
  INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
  VALUES (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );
  `
  const postDistrictResponse = await db.run(postDistrictQuery)
  const districtId = postDistrictResponse.lastID
  console.log(postDistrictResponse)
  console.log({district_id: districtId})
  response.send('District Successfully Added')
})

//API 5
app.get(
  '/districts/:districtId/',
  AuthenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
  SELECT *
  FROM district
  WHERE district_id = ${districtId};`

    const getDistrictResponse = await db.get(getDistrictQuery)
    response.send({
      districtId: getDistrictResponse.district_id,
      districtName: getDistrictResponse.district_name,
      stateId: getDistrictResponse.state_id,
      cases: getDistrictResponse.cases,
      cured: getDistrictResponse.cured,
      active: getDistrictResponse.active,
      deaths: getDistrictResponse.deaths,
    })
  },
)

//API 6
app.delete(
  '/districts/:districtId/',
  AuthenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//API 7
app.put(
  '/districts/:districtId/',
  AuthenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const putDistictQuery = `
  UPDATE district
  SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE district_id = ${districtId};`
    await db.run(putDistictQuery)
    response.send('District Details Updated')
  },
)

//API 8
app.get(
  '/states/:stateId/stats/',
  AuthenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatusQuery = `
  SELECT 
    SUM(cases) AS totalCases, 
    SUM(cured) AS totalCured, 
    SUM(active) AS totalActive, 
    SUM(deaths) AS totalDeaths
  FROM district
  WHERE state_id= ${stateId};`
    const getStatusResponse = await db.get(getStatusQuery)
    response.send(getStatusResponse)
    console.log(getStatusResponse)
  },
)

module.exports = app
