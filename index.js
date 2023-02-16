import * as dotenv from "dotenv";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";
import fs from "fs";

dotenv.config();

const getDataFromPage = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(process.env.URL);
  await page.waitForSelector(".history-list-item", {
    timeout: 10000,
  });
  const result = await page.evaluate(() => {
    const elements = document.querySelectorAll(".history-list-item");
    const data = [];
    for (let element of elements) {
      data.push({
        date: element.querySelector(".date").innerText,
        lead: element.querySelector(".lead").innerText,
        location: element.querySelector(".location").innerText.trim(),
      });
    }
    return data;
  });

  await browser.close();
  return result;
};

const saveData = (data) => {
  let cache = null;
  if (fs.existsSync("cache.json")) {
    cache = fs.readFileSync("cache.json", "utf8");
  }
  if (cache === JSON.stringify(data)) {
    console.log("No changes");
    return false;
  }
  fs.writeFileSync("cache.json", JSON.stringify(data));
  console.log("Changes detected");
  return true;
};

const sendMail = (data) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: "web-notifier",
    to: process.env.EMAIL_TO,
    subject: "GLS Changes detected",
    text: `
URL: ${process.env.URL}
    ${data
      .map(
        (item) => `
Date: ${item.date}
Lead: ${item.lead}
Location: ${item.location}
`
      )
      .join("\n")}`,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

const mainLoop = async () => {
  const data = await getDataFromPage();
  const isChanged = saveData(data);
  if (isChanged) {
    sendMail(data);
  }
};

(async () => {
  await mainLoop();
  setInterval(mainLoop, 1000 * 60 * 60);
})();
