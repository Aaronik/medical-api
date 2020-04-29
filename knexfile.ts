const url = require('url')

if (process.env.JAWSDB_URL) { // This is heroku specific
  // The CLEARDB_DATABASE_URL looks like
  // mysql://adffdadf2341:adf4234@us-cdbr-east.cleardb.com/heroku_db?reconnect=true. (This is from the heroku
  // documentation, don't worry.) If this block is being executed, we're running on heroku and need to connect
  // to their supplied DB. Ok now we're using JAWSDB b/c clearDB only supports mysql 5.5.x, and we need >=5.6.5
  // to support datetime DEFAULT NOW() fields. But it's the same deal.

  const query = url.parse(process.env.JAWSDB_URL, false)
  const [ user, password ] = query.auth.split(':')
  const host = query.hostname
  const database = query.pathname.slice(1) // remove the preceding '/'

  const connection = { host, user, password, database }

  console.log(query)
  console.log(connection)

  module.exports = {
    client: 'mysql',
    connection
  }

} else {
  module.exports = {
    client: 'mysql',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DB,
      port: process.env.DB_PORT
    }
  }
}
