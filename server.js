const fs = require("fs");
const express = require("express");

if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.static("public"));
app.post("/api/chat", require("./api/chat"));

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
