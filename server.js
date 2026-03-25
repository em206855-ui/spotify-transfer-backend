const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let tokens = {};

// LOGIN
app.get("/login/:type", (req, res) => {
  const scope = "playlist-read-private playlist-modify-private playlist-modify-public";

  const url = "https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      response_type: "code",
      client_id: CLIENT_ID,
      scope,
      redirect_uri: REDIRECT_URI,
      state: req.params.type
    });

  res.redirect(url);
});

// CALLBACK
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    querystring.stringify({
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code"
    }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  tokens[state] = response.data.access_token;

  res.send("Login erfolgreich – zurück zur App!");
});

// PLAYLISTS
app.get("/playlists/:type", async (req, res) => {
  const token = tokens[req.params.type];

  const response = await axios.get("https://api.spotify.com/v1/me/playlists", {
    headers: { Authorization: "Bearer " + token }
  });

  res.json(response.data.items);
});

// TRANSFER
app.post("/transfer", async (req, res) => {
  const { playlists } = req.body;

  const oldToken = tokens.oldUser;
  const newToken = tokens.newUser;

  const profile = await axios.get("https://api.spotify.com/v1/me", {
    headers: { Authorization: "Bearer " + newToken }
  });

  const userId = profile.data.id;

  for (let p of playlists) {
    let tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${p.id}/tracks`;

    while (url) {
      const r = await axios.get(url, {
        headers: { Authorization: "Bearer " + oldToken }
      });
      tracks.push(...r.data.items);
      url = r.data.next;
    }

    const uris = tracks.map(t => t.track.uri).filter(Boolean);

    const newPlaylist = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      { name: p.name, public: false },
      { headers: { Authorization: "Bearer " + newToken } }
    );

    for (let i = 0; i < uris.length; i += 100) {
      await axios.post(
        `https://api.spotify.com/v1/playlists/${newPlaylist.data.id}/tracks`,
        { uris: uris.slice(i, i + 100) },
        { headers: { Authorization: "Bearer " + newToken } }
      );
    }
  }

  res.send("Fertig");
});

app.listen(process.env.PORT || 3000);
