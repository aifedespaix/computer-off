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

    // 1. API Endpoint: Shutdown
    if (url.pathname === "/shutdown" && req.method === "POST") {
      console.log(
        `[${new Date().toLocaleTimeString()}] ⚠️  Demande d'arrêt reçue...`
      );

      try {
        // Étape 1 : GoXLR
<<<<<<< HEAD
        // console.log(`> Exécution : ${CMD_GOXLR}`);
        // Note: Sur Windows, il est souvent préférable d'utiliser 'shell: true' ou d'invoquer via cmd /c
        // Pour Bun natif, on peut utiliser Bun.spawn, mais child_process est parfois plus stable pour les commandes Windows legacy.
        // On va tenter une approche séquentielle simple avec spawn.

        // Mock execution check for testing environment (if needed), but here we write for Prod.
        // We wrap in a promise to await execution
=======
>>>>>>> c483d9ae54bc349274a359924c1662e68fb1ef48
        // await runCommand(CMD_GOXLR);

        // Étape 2 : Shutdown
        console.log(`> Exécution : ${CMD_SHUTDOWN}`);
        await runCommand(CMD_SHUTDOWN);

        return new Response(
          JSON.stringify({
            status: "success",
            message: "PC en cours d'extinction",
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("❌ Erreur lors de l'exécution des commandes:", error);
        return new Response(
          JSON.stringify({ status: "error", message: String(error) }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // 2. Static File Serving
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
  return new Promise((resolve, reject) => {
    const process = spawn(command, { shell: true, stdio: "inherit" });

<<<<<<< HEAD
    // Using Bun.spawn is preferred in Bun, but let's stick to node:child_process
    // for maximum compatibility with Windows shell commands string parsing.

    const process = spawn(command, { shell: true, stdio: "inherit" });

=======
>>>>>>> c483d9ae54bc349274a359924c1662e68fb1ef48
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
<<<<<<< HEAD
        // On ne reject pas forcément pour le GoXLR si la commande échoue (ex: pas installé),
        // on veut peut-être quand même éteindre le PC ?
        // Pour l'instant on log l'erreur mais on resolve pour continuer (soft fail).
=======
>>>>>>> c483d9ae54bc349274a359924c1662e68fb1ef48
        console.warn(
          `⚠️  La commande "${command}" a terminé avec le code ${code}. Continuation...`
        );
        resolve();
      }
    });

    process.on("error", (err) => {
      console.error(`❌ Erreur fatale commande "${command}":`, err);
      resolve();
    });
  });
}
