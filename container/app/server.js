const express = require("express");
const multer = require("multer");
const { Storage } = require("@google-cloud/storage");
const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "/tmp/uploads/" });

/*
|--------------------------------------------------------------------------
| GCP Clients
|--------------------------------------------------------------------------
*/

const storage = new Storage();
const bucketName = process.env.BUCKET_NAME;

// @google/genai is Google's unified AI SDK (replaces @google/generative-ai).
// It supports both Gemini (text/audio) and Imagen (image generation)
// through the same generativelanguage.googleapis.com endpoint.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/*
|--------------------------------------------------------------------------
| Genre → Band Influence Map
|--------------------------------------------------------------------------
| Maps detected genre to an iconic band and their visual aesthetic.
| This is used to craft the Imagen prompt.
*/

const GENRE_MAP = {
    rock:       { band: "Led Zeppelin",     aesthetic: "dark, raw, vintage concert poster, bold typography, earth tones, 1970s rock" },
    metal:      { band: "Black Sabbath",    aesthetic: "dark, gothic, skull imagery, heavy black and red, occult symbols, dramatic" },
    jazz:       { band: "Miles Davis",      aesthetic: "cool blue tones, smoky club atmosphere, abstract art, 1950s jazz poster style" },
    classical:  { band: "Beethoven",        aesthetic: "elegant, gold and black, ornate typography, concert hall grandeur, timeless" },
    electronic: { band: "Daft Punk",        aesthetic: "futuristic, neon lights, circuit patterns, robotic, dark background, glowing" },
    hiphop:     { band: "Kendrick Lamar",   aesthetic: "urban, bold street art, Compton, vibrant colors, graffiti, powerful imagery" },
    pop:        { band: "David Bowie",      aesthetic: "glam, colorful, theatrical, lightning bolt, avant-garde, vibrant and bold" },
    blues:      { band: "BB King",          aesthetic: "warm sepia tones, Mississippi delta, vintage Southern feel, soulful, rustic" },
    country:    { band: "Johnny Cash",      aesthetic: "black and white, americana, rugged, open road, stark, Man in Black aesthetic" },
    reggae:     { band: "Bob Marley",       aesthetic: "red gold green, tropical, roots, unity, warm sunshine, Rastafari colors" },
    soul:       { band: "Aretha Franklin",  aesthetic: "warm golds, powerful, Detroit soul, velvet, rich textures, gospel-inspired" },
    punk:       { band: "The Clash",        aesthetic: "raw, anarchic, torn paper, black and white with red accents, London streets" },
};

const DEFAULT_INFLUENCE = {
    band: "Pink Floyd",
    aesthetic: "psychedelic, cosmic, surreal, dark side of the moon prism, space, dreamlike colors",
};

/*
|--------------------------------------------------------------------------
| MIME type map — multer often reports audio as application/octet-stream
|--------------------------------------------------------------------------
*/

const MIME_MAP = {
    ".mp3":  "audio/mpeg",
    ".wav":  "audio/wav",
    ".ogg":  "audio/ogg",
    ".flac": "audio/flac",
    ".m4a":  "audio/mp4",
    ".aac":  "audio/aac",
};

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

// Serve the frontend from the public/ folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "Cloud Frequencies" });
});

/*
|--------------------------------------------------------------------------
| POST /generate
|--------------------------------------------------------------------------
| 1. Receive uploaded audio file
| 2. Send to Gemini for genre + mood detection
| 3. Map genre to band influence
| 4. Build Imagen prompt
| 5. Generate poster via Imagen 3
| 6. Upload poster to GCS
| 7. Return public URL
*/

app.post("/generate", upload.single("song"), async (req, res) => {
    const tempFilePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file uploaded. Use field name: song" });
        }

        console.log(`[1/5] Received file: ${req.file.originalname} (${req.file.mimetype})`);

        // ── Step 1: Read audio file as base64 ──
        const audioBytes = fs.readFileSync(tempFilePath).toString("base64");
        const ext = path.extname(req.file.originalname).toLowerCase();
        const mimeType = MIME_MAP[ext] || "audio/mpeg";

        console.log(`[1/5] Using MIME type: ${mimeType}`);

        // ── Step 2: Gemini — detect genre and mood ──
        // @google/genai SDK: ai.models.generateContent({ model, contents })
        // In Terraform terms: this is like calling an API data source
        console.log("[2/5] Sending to Gemini for genre detection...");

        const geminiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: audioBytes,
                            },
                        },
                        {
                            text: `Analyze this audio and respond with a JSON object only — no explanation, no markdown.
Format: {"genre": "<single genre>", "mood": "<2-3 word mood>", "energy": "<low|medium|high>"}
Genre must be one of: rock, metal, jazz, classical, electronic, hiphop, pop, blues, country, reggae, soul, punk.
If unsure, pick the closest match.`,
                        },
                    ],
                },
            ],
        });

        // In @google/genai SDK, response.text is a direct property (not a method call)
        const rawText = geminiResponse.text.trim();
        console.log(`[2/5] Gemini response: ${rawText}`);

        let genreData;
        try {
            genreData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        } catch {
            genreData = { genre: "rock", mood: "energetic", energy: "high" };
        }

        const genre = genreData.genre?.toLowerCase() || "rock";
        const mood = genreData.mood || "powerful";
        const influence = GENRE_MAP[genre] || DEFAULT_INFLUENCE;

        console.log(`[3/5] Genre: ${genre} → Band influence: ${influence.band}`);

        // ── Step 3: Build Imagen prompt ──
        const imagenPrompt = `A music concert poster inspired by the visual aesthetic of ${influence.band}.
Style: ${influence.aesthetic}.
Mood: ${mood}.
High quality, detailed illustration, no text, professional poster art.`;

        console.log(`[4/5] Generating poster with Imagen 3...`);

        // ── Step 4: Generate image via Imagen 4 ──
        // imagen-4.0-fast-generate-001 is available via generativelanguage.googleapis.com
        // (confirmed from ListModels). Uses ai.models.generateImages() in @google/genai SDK.
        // In Terraform terms: this is another API call data source, just for images.
        const imagenResponse = await ai.models.generateImages({
            model: "imagen-4.0-fast-generate-001",
            prompt: imagenPrompt,
            config: {
                numberOfImages: 1,
                aspectRatio: "3:4",     // portrait — suits a concert poster
            },
        });

        const imageBase64 = imagenResponse.generatedImages[0].image.imageBytes;
        const imageBuffer = Buffer.from(imageBase64, "base64");

        // ── Step 5: Upload poster to GCS ──
        console.log("[5/5] Uploading poster to GCS...");

        const fileName = `posters/${uuidv4()}.png`;
        const file = storage.bucket(bucketName).file(fileName);

        // public: true (per-object ACL) is incompatible with uniform bucket-level access.
        // Public read is handled at the bucket level via IAM (allUsers objectViewer)
        // set in the storage Pulumi stack — so no ACL needed here.
        await file.save(imageBuffer, {
            metadata: { contentType: "image/png" },
        });

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

        console.log(`Done. Poster URL: ${publicUrl}`);

        return res.json({
            success: true,
            genre,
            mood,
            band_influence: influence.band,
            poster_url: publicUrl,
        });

    } catch (err) {
        console.error("Error generating poster:", err);
        return res.status(500).json({ error: err.message });
    } finally {
        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const port = process.env.PORT || 8080;

app.listen(port, () => {
    console.log(`Cloud Frequencies listening on port ${port}`);
});
