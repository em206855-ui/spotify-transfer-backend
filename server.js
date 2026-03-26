const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Server läuft v2!");
});

app.get("/test", (req, res) => {
  res.send("CLIENT_ID: " + process.env.CLIENT_ID);
});
const CLIENT_ID = "277e32be70b64b02b8ee8fa7e8a22a6c";
const CLIENT_SECRET = "79d981c6c512473e830ba45e7601c2b2";
const REDIRECT_URI = "https://spotify-transfer-backend-production.up.railway.app/callback";

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

// 🔥 TRANSFER (GET für Browser)
app.get("/transfer", async (req, res) => {
  try {
    const oldToken = tokens.oldUser;
    const newToken = tokens.newUser;

    if (!oldToken || !newToken) {
      return res.send("Bitte beide Accounts einloggen!");
    }

    const playlistsRes = await axios.get("https://api.spotify.com/v1/me/playlists", {
      headers: { Authorization: "Bearer " + oldToken }
    });

    const playlists = playlistsRes.data.items;

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

      const uris = tracks.map(t => t.track?.uri).filter(Boolean);

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

    res.send("✅ Transfer fertig!");
  } catch (err) {
    console.error(err);
    res.send("❌ Fehler beim Transfer");
  }
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
        { headers: { Authorization: "Bearer " + newToken }
      });
    }
  }

  res.send("Transfer fertig!");
});
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
