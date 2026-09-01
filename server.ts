import { serve } from "bun";
import { networkInterfaces } from "os";
import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";

// --- CONFIGURATION ---
const PORT = 3000;
// Note: Modifier ces commandes selon votre configuration exacte
const CMD_GOXLR = "goxlr-client load-profile Sleep";
const CMD_SHUTDOWN = "shutdown /s /t 0";

// --- UTILS ---
function getLocalIp() {
  const nets = networkInterfaces();
  const results = Object.create(null);

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }

  // Return the first found non-internal IPv4
  const allIps = Object.values(results).flat();
  return allIps.length > 0 ? allIps[0] : "localhost";
}

// --- CERTIFICATES GENERATION ---
const CERT_DIR = "certs";
const KEY_PATH = `${CERT_DIR}/key.pem`;
const CERT_PATH = `${CERT_DIR}/cert.pem`;

if (!existsSync(KEY_PATH) || !existsSync(CERT_PATH)) {
  console.log("⚠️  Certificats SSL manquants. Génération en cours...");
  try {
    if (!existsSync(CERT_DIR)) {
      mkdirSync(CERT_DIR);
    }
    // Génération silencieuse de certificats auto-signés valables 1 an
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -nodes -subj "/C=FR/ST=France/L=Paris/O=PCControl/CN=PC Control Local"`,
      { stdio: "ignore" }
    );
    console.log("✅ Certificats générés avec succès dans ./certs/");
  } catch (err) {
    console.error("❌ Erreur lors de la génération des certificats OpenSSL. Assurez-vous qu'OpenSSL est installé.", err);
    process.exit(1);
  }
}

// --- SCHEDULED SHUTDOWN STATE ---
// A single pending shutdown can be scheduled at a time. Kept in memory only:
// this is a small local-network tool, restarting the server clears it.
let scheduled: { targetTime: number; timer: ReturnType<typeof setTimeout> } | null = null;

function clearSchedule() {
  if (scheduled) {
    clearTimeout(scheduled.timer);
    scheduled = null;
  }
}

function scheduleShutdown(targetTime: number) {
  clearSchedule();
  const delay = Math.max(targetTime - Date.now(), 0);
  scheduled = {
    targetTime,
    timer: setTimeout(() => {
      scheduled = null;
      executeShutdown().catch((err) =>
        console.error("❌ Erreur lors de l'extinction programmée:", err)
      );
    }, delay),
  };
}

async function executeShutdown() {
  console.log(`[${new Date().toLocaleTimeString()}] ⚠️  Extinction en cours...`);
  // Étape 1 : GoXLR (désactivé par défaut, décommenter si utilisé)
  // await runCommand(CMD_GOXLR);

  // Étape 2 : Shutdown
  console.log(`> Exécution : ${CMD_SHUTDOWN}`);
  await runCommand(CMD_SHUTDOWN);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- SERVER ---
console.log(`\n🚀 Serveur de Contrôle PC démarré !`);
console.log(`📱 Accédez à l'app via : https://${getLocalIp()}:${PORT}`);
console.log(`🔒 Appuyez sur Ctrl+C pour arrêter le serveur.\n`);

serve({
  port: PORT,
  tls: {
    key: Bun.file(KEY_PATH),
    cert: Bun.file(CERT_PATH),
  },
  async fetch(req) {
    const url = new URL(req.url);

    // 1. API Endpoint: Shutdown immédiat
    if (url.pathname === "/shutdown" && req.method === "POST") {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️  Demande d'arrêt immédiat reçue...`);
      clearSchedule();

      try {
        await executeShutdown();
        return jsonResponse({ status: "success", message: "PC en cours d'extinction" });
      } catch (error) {
        console.error("❌ Erreur lors de l'exécution des commandes:", error);
        return jsonResponse({ status: "error", message: String(error) }, 500);
      }
    }

    // 2. API Endpoint: Programmer une extinction
    if (url.pathname === "/schedule" && req.method === "POST") {
      let body: { targetTime?: number };
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ status: "error", message: "Corps de requête invalide" }, 400);
      }

      const targetTime = Number(body.targetTime);
      if (!Number.isFinite(targetTime) || targetTime <= Date.now()) {
        return jsonResponse(
          { status: "error", message: "targetTime doit être un timestamp futur" },
          400
        );
      }

      scheduleShutdown(targetTime);
      console.log(
        `[${new Date().toLocaleTimeString()}] ⏰ Extinction programmée à ${new Date(targetTime).toLocaleTimeString()}`
      );
      return jsonResponse({ status: "success", targetTime });
    }

    // 3. API Endpoint: Annuler la programmation
    if (url.pathname === "/schedule" && req.method === "DELETE") {
      clearSchedule();
      console.log(`[${new Date().toLocaleTimeString()}] 🛑 Programmation annulée`);
      return jsonResponse({ status: "success" });
    }

    // 4. API Endpoint: Statut de la programmation
    if (url.pathname === "/schedule" && req.method === "GET") {
      return jsonResponse({
        active: scheduled !== null,
        targetTime: scheduled?.targetTime ?? null,
      });
    }

    // 5. Static File Serving
    let filePath = url.pathname;
    if (filePath === "/") filePath = "/index.html";

    // Security check: Prevent directory traversal
    const safePath = filePath.replace(/^(\.\.[\/\\])+/, "");
    const src = "public" + safePath;

    if (safePath.includes("..")) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(src);

    if (await file.exists()) {
      return new Response(file);
    }

    // 404
    return new Response("Not Found", { status: 404 });
  },
});

// Helper function to run shell commands
function runCommand(command: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(command, { shell: true, stdio: "inherit" });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.warn(`⚠️  La commande "${command}" a terminé avec le code ${code}. Continuation...`);
      }
      resolve();
    });

    proc.on("error", (err) => {
      console.error(`❌ Erreur fatale commande "${command}":`, err);
      resolve();
    });
  });
}
