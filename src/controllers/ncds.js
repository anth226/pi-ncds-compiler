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
    LIMIT 500
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
  await status.set(CONSOLIDATOR_STATUS_TEST, "OFF");
  console.log("Consolidator turned off.");
}

export async function consolidate() {
  let consolidator_status = await status.get(CONSOLIDATOR_STATUS_TEST);

  if (consolidator_status == "ON") {
    console.log("Consolidator already on, skipping...");
    return;
  }

  await status.set(CONSOLIDATOR_STATUS_TEST, "ON");
  console.log("Consolidator turned on...");

  let result = await getRawData();

  if (result && result.length > 0) {
    console.log("Consolidator found data, consolidating...");
    let smartTrades = new Map();
    let ids = "(";

    for (let i in result) {
      let id = result[i].id;
      ids += id;
      ids += ",";

      let optContract = result[i].option_contract;

      if (smartTrades.has(optContract)) {
        let trades = await smartTrades.get(optContract);
        await trades.push(result[i]);
        smartTrades.set(optContract, trades);
      } else {
        let trades = [];
        trades.push(result[i]);
        smartTrades.set(optContract, trades);
      }
    }
    console.log("!!!\n\n\nDone consolidating...\n\n\n!!!");

    smartTrades.forEach(async (value, key) => {
      queue.publish_SmartOptions(value);
    });

    ids = ids.substring(0, ids.length - 1);

    ids += ")";

    await db2(`
    UPDATE options_raw_test
    SET is_processed = true
    WHERE id IN ${ids}
    `);

    console.log("Done processing..");
  } else {
    console.log("Consolidator polled no result.");
  }
  await status.set(CONSOLIDATOR_STATUS_TEST, "OFF");
  console.log("Consolidator turned off.");
}
