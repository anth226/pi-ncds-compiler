import db2 from "../db2";
import status from "../redis_status";
import * as queue from "../queue";

const cons = "CONS-" + process.env.RELEASE_STAGE;

export async function getRawData() {
  // const moment = require("moment-timezone");
  // let time = moment().tz("America/New_York").valueOf();
  // time = (time - (time % 1000)) / 1000;
  // //3600 = 1 hour
  // let limit = time - 2;

  let result = await db2(`
    SELECT *
    FROM options_raw
    WHERE time = (SELECT MIN(time) FROM options_raw WHERE is_processed = false) AND is_processed = false
    LIMIT 400
        `);

  return result;
}

export async function checkUnprocessedRawData() {
  let result = await db2(`
    SELECT id, is_processed
    FROM options_raw
    WHERE is_processed = false
    LIMIT 1
        `);

  return result;
}

export async function getSmartTrade(optContract, time) {
  let result = await db2(`
    SELECT *
    FROM options
    WHERE option_contract = '${optContract}' AND time = ${time}
    `);

  return result[0];
}

export async function turnOffConsolidator() {
  await status.set(cons, "OFF");
  console.log("Consolidator turned off.");
}

export async function turnOnConsolidator() {
  await status.set(cons, "ON");
  console.log("Consolidator turned on.");
}

export async function consolidate() {
  let consolidator_status = await status.get(cons);

  if (consolidator_status == "ON") {
    console.log("Consolidator already on, skipping...");
    return;
  }

  await status.set(cons, "ON");
  console.log("Consolidator turned on...");

  let result = await getRawData();

  if (result && result.length > 0) {
    console.log("Consolidator found data, sending to sqs...");
    
    let ids = "(";
    for (let i in result) {
      let id = result[i].id;
      ids += id;
      ids += ",";
    }
    ids = ids.substring(0, ids.length - 1);
    ids += ")";

    await db2(`
    UPDATE options_raw
    SET is_processed = true
    WHERE id IN ${ids}
    `);

    await queue.publish_SmartOptions(result);

    await status.set(cons, "OFF");
    console.log("Done processing.");
  } else {
    console.log("Consolidator polled no result.");
  }
  await status.set(cons, "OFF");
  console.log("Consolidator turned off.");

  let checkProcess = await checkUnprocessedRawData();
  if (checkProcess.length > 0) {
    await consolidate();
  }
}
