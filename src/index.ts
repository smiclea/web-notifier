import * as dotenv from "dotenv";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";
import fs from "fs";

dotenv.config();

type DataItem = {
  date: string;
  lead: string;
  location: string;
};

const getDataFromPage = async (): Promise<DataItem[]> => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(process.env.URL);
  await page.waitForSelector(".history-list-item", {
    timeout: 10000,
  });
  const data = await page.$$eval(".history-list-item", (elements) =>
    elements.map((element) => ({
      date: (element.querySelector(".date") as HTMLElement).innerText,
      lead: (element.querySelector(".lead") as HTMLElement).innerText,
      location: (
        element.querySelector(".location") as HTMLElement
      ).innerText.trim(),
    }))
  );
  await browser.close();
  return data;
};

const saveData = (data: DataItem[]) => {
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

const sendMail = (data: DataItem[]) => {
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
  if (saveData(data)) {
    sendMail(data);
  }
};

(async () => {
  await mainLoop();
  setInterval(mainLoop, 1000 * 60 * 60);
})();
