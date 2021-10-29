const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const jsStringify = require("js-stringify");
const { DateTime } = require("luxon");
const util = require("util");
const multer = require('multer');
const upload = multer();

// used to get the YT video number of likes
const {google} = require("googleapis");
const youtube = google.youtube("v3");

// used to update YT video title
const axios = require('axios');
const qs = require('qs');

// tell view engine to use pug and look for views in /app/src/pages
app.set("view engine", "pug");
app.set("views", "/app/src/pages");

// tell app where to load static files from (js, css, png, vids, etc..)
app.use("/", express.static("/app/public"));
// for parsing application/json
app.use("/", bodyParser.json());
// for parsing application/xwww-
app.use("/", bodyParser.urlencoded({ extended: true }));
// multer (file uploads) and express-session
app.use("/", upload.array());

// ------ util functions: start ---------
function getCurrTimeEST() {
  return DateTime.local().setZone('America/New_York').toSQL({ includeOffset: false });
}
async function logMsg(msg){
  await console.log(getCurrTimeEST() + " (EST): " + msg);
}
async function timeout(ms) {
    return new Promise(function(resolve){setTimeout(resolve, ms);});
}
function formatNumber(n) {
    var parts = n.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}
// ------ util functions: end ---------

// update TY video title with its number of likes every 9 minutes
async function mainLoop(portNum){
  var boolServerInitLog = true;
  while(true){
    try{
      if (boolServerInitLog) {
        await logMsg("Your app is listening on port " + portNum);
        boolServerInitLog = false;
      }
      
      await logMsg("--------------- server-side mainLoop() start ---------------");
      let likeCount = await getLikeCount(process.env.YT_MY_VIDEO_ID);
      let updatedTitle =  await updateVideoTitle(process.env.YT_MY_VIDEO_ID, likeCount);
      await logMsg("title updated to: " + updatedTitle);
      await logMsg("--------------- server-side mainLoop() end -----------------");
      // 9 minute timeout
      await timeout(540000); 
    } catch (err) {
      await logMsg("--------------- server-side mainLoop() failure: ------------");
      await logMsg(err);
      // 9 minute timeout
      await timeout(540000); 
    }
  }
}

async function getLikeCount(vidID) { 
    try {
        let response = await youtube.videos.list({key: process.env.YT_API_KEY, "part": ["statistics"], "id": [vidID]});
        return await formatNumber(response.data.items[0].statistics.likeCount);
    } catch (err) {
        throw err;
    }
}

async function getAccessToken() {
    try {
        let data = await qs.stringify({});
        let config = {
            method: "post",
            url: "https://oauth2.googleapis.com/token?client_id="+process.env.CLIENT_ID+"&client_secret="+process.env.CLIENT_SECRET+"&grant_type=refresh_token&refresh_token="+process.env.REFRESH_TOKEN,
            headers: { },
            data : data
        };
        let response = await axios(config);
        return await response.data.access_token;
    } catch (err) {
        throw err;
    }
}

async function updateVideoTitle(vidID, likeCount) {
    try {
        let data = JSON.stringify({
            "id": vidID,
            "snippet": {
                "categoryId": 22,
                "defaultLanguage": "en",
                "description": "TODO update this part of the code with a description",
                "tags": [
                    "TODO add tags"
                ],
                "title":  "Let's count to 1 million (1 like = 1 count). " + likeCount + " / " + formatNumber(1000000) + " (this title updates every 9 minutes)"
            }
        });
        let config = {
            method: "put",
            url: "https://youtube.googleapis.com/youtube/v3/videos?part=snippet&key="+process.env.YT_API_KEY,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer "+ await getAccessToken()
            },
            data : data
        };
      
        let response = await axios(config);
        return await response.data.snippet.title;
      } catch (err) {
          throw err;
      }
}

app.get("/", function(req, res) {
  logMsg("homepage served");
  return res.render("/app/src/pages/index.pug", {YT_MY_VIDEO_URL: "https://youtu.be/"+process.env.YT_MY_VIDEO_ID});
});

// official app start (counter)
const listener = app.listen(3000, function () {mainLoop(listener.address().port);});