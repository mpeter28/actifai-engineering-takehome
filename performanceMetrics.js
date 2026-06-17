const { Client } = require('pg');

function makePgClient() {
  const pgClient = new Client({
    host: 'db',
    port: '5432',
    user: 'user',
    password: 'pass',
    database: 'actifai'
  });
  pgClient.connect();

  return pgClient;
}

const monthlySalesForUserQuery = `
  SELECT TO_CHAR(date, 'YYYY-MM') AS time_interval,
         COUNT(sales.id) AS number_of_sales,
         SUM(sales.amount) AS total_revenue
  FROM sales
  JOIN users ON sales.user_id = users.id
  WHERE users.id = $1
  AND TO_CHAR(date, 'YYYY-MM') >= $2
  AND TO_CHAR(date, 'YYYY-MM') <= $3
  GROUP BY time_interval
  ORDER BY time_interval DESC
`

const yearMonthPattern = /^\d{4}-\d{2}$/

async function performanceMetricsForUser(req, res, next) {
  const payload = req.body

  const userId = payload.userId
  if (typeof userId !== "number") {
    next(new Error("userId must be a number"))
    return
  }

  const startMonth = payload.startMonth || '0000-01'
  const stopMonth = payload.stopMonth || '9999-12'
  if (!yearMonthPattern.test(startMonth) || !yearMonthPattern.test(stopMonth)) {
    next(new Error("startMonth and stopMonth must be in YYYY-MM format"))
    return
  }

  let queryResult
  const pgClient = makePgClient()
  try {
    queryResult = await pgClient.query(monthlySalesForUserQuery, [userId, startMonth, stopMonth]);
  } catch (err) {
    next(err)
    return
  } finally {
    pgClient.end()
  }

  const metricSeries = queryResult.rows.map((row) => {
    return {
        timeInterval: row.time_interval,
        numberOfSales: row.number_of_sales,
        totalRevenue: row.total_revenue,
        averageRevenuePerSale: row.total_revenue / row.number_of_sales,
    }
  })

  res.json({
    userId,
    metricSeries,
  });
}

const monthlySalesForGroupQuery = `
  SELECT TO_CHAR(date, 'YYYY-MM') AS time_interval,
         COUNT(sales.id) AS number_of_sales,
         COUNT(DISTINCT users.id) AS number_of_users,
         SUM(sales.amount) AS total_revenue
  FROM sales
  JOIN users ON sales.user_id = users.id
  JOIN user_groups ON users.id = user_groups.user_id
  JOIN groups ON groups.id = user_groups.group_id
  WHERE groups.id = $1
  AND TO_CHAR(date, 'YYYY-MM') >= $2
  AND TO_CHAR(date, 'YYYY-MM') <= $3
  GROUP BY time_interval
  ORDER BY time_interval DESC
`

async function performanceMetricsForGroup(req, res, next) {
  const payload = req.body

  const groupId = payload.groupId
  if (typeof groupId !== "number") {
    next(new Error("groupId must be a number"))
    return
  }

  const startMonth = payload.startMonth || '0000-01'
  const stopMonth = payload.stopMonth || '9999-12'
  if (!yearMonthPattern.test(startMonth) || !yearMonthPattern.test(stopMonth)) {
    next(new Error("startMonth and stopMonth must be in YYYY-MM format"))
    return
  }

  let queryResult
  const pgClient = makePgClient()
  try {
    queryResult = await pgClient.query(monthlySalesForGroupQuery, [groupId, startMonth, stopMonth]);
  } catch (err) {
    next(err)
    return
  } finally {
    pgClient.end()
  }

  const metricSeries = queryResult.rows.map((row) => {
    return {
        timeInterval: row.time_interval,
        numberOfSales: row.number_of_sales,
        totalRevenue: row.total_revenue,
        averageRevenuePerSale: row.total_revenue / row.number_of_sales,
        averageRevenuePerActiveSeller: row.total_revenue / row.number_of_users,
    }
  })

  res.json({
    groupId,
    metricSeries,
  });
}

module.exports = {
  performanceMetricsForUser,
  performanceMetricsForGroup,
}