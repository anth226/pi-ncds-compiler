import asyncRedis from "async-redis";
import redis from "redis";

let db;

export let CONSOLIDATOR_STATUS = "OFF";

function connectDatabase() {
  let credentials = {
    host: process.env.STATUS_HOST,
    port: process.env.STATUS_PORT,
  };

  if (!db) {
    const client = redis.createClient(credentials);
    client.on("error", function (error) {
      console.log(error);
    });

    db = asyncRedis.decorate(client);
  }
  return db;
}

export default connectDatabase();
