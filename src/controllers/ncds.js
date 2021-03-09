import db2 from "../db2";
import status, { CONSOLIDATOR_STATUS_TEST } from "../redis_status";
import * as queue from "../queue";

export async function getRawData() {
  // const moment = require("moment-timezone");
  // let time = moment().tz("America/New_York").valueOf();
  // time = (time - (time % 1000)) / 1000;
  // //3600 = 1 hour
  // let limit = time - 2;

  let result = await db2(`
    SELECT *
    FROM options_raw_test
    WHERE time = (SELECT MIN(time) FROM options_raw_test WHERE is_processed = false) AND is_processed = false
        `);

  return result;
}

export async function getSmartTrade(optContract, time) {
  let result = await db2(`
    SELECT *
    FROM options_test
    WHERE option_contract = '${optContract}' AND time = ${time}
    `);

  return result[0];
}

export async function turnOffConsolidator() {
  status.set(CONSOLIDATOR_STATUS_TEST, "OFF");
}

export async function consolidate() {
  let consolidator_status = await status.get(CONSOLIDATOR_STATUS_TEST);

  if (consolidator_status == "ON") {
    console.log("Consolidator already on, skipping...");
    return;
  }

  status.set(CONSOLIDATOR_STATUS_TEST, "ON");
  console.log("Consolidator turned on...");

  let result = await getRawData();

  if (result && result.length > 0) {
    for (let i in result) {
      let id = result[i].id;

      //set is_processed to true
      let query = {
        text: "UPDATE options_raw_test SET is_processed = true WHERE id = $1",
        values: [id],
      };
      await db2(query);
    }
    queue.publish_SmartOptions(result);
  } else {
    console.log("Consolidator polled no result.");
  }
  status.set(CONSOLIDATOR_STATUS_TEST, "OFF");
  console.log("Consolidator turned off.");
}
