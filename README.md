# PC Control - Télécommande Locale PWA

Une application Web Progressive (PWA) minimaliste et premium pour contrôler votre PC (GoXLR et Extinction) depuis votre mobile via le réseau local.

## Prérequis

*   [Bun.js](https://bun.sh/) installé sur le PC à contrôler.
*   Un réseau Wi-Fi local où le PC et le mobile sont connectés.
*   (Optionnel) Vos propres icônes pour l'application.

## Installation et Démarrage

1.  **Récupérer le projet** :
    Clonez ce dossier sur votre PC.

2.  **Ajouter votre icône (Optionnel mais recommandé)** :
    Placez une image PNG (carrée, idéalement 512x512px) nommée `icon.png` dans le dossier `public/`, en remplaçant celle existante si nécessaire.

3.  **Lancer le serveur** :
    Ouvrez un terminal dans le dossier du projet et lancez :
    ```bash
    bun server.ts
    ```

4.  **Récupérer l'adresse IP** :
    Au démarrage, le terminal affichera quelque chose comme :
    ```
    🚀 Serveur de Contrôle PC démarré !
    📱 Accédez à l'app via : https://192.168.1.15:3000
    ```
    Notez cette URL (l'IP `192.168.x.x` est importante).

## Installation sur Mobile (iOS / Android)

1.  Prenez votre téléphone connecté au **même réseau Wi-Fi**.
2.  Ouvrez votre navigateur (Safari sur iOS, Chrome sur Android).
3.  Tapez l'URL affichée par le serveur (ex: `https://192.168.1.15:3000`).
    > **⚠️ IMPORTANT** : Comme le certificat est "auto-signé", vous aurez un avertissement de sécurité.
    > *   Cliquez sur **"Paramètres avancés"** (ou "Détails").
    > *   Puis cliquez sur **"Continuer vers..."** (ou "Accepter le risque").
4.  L'interface de l'application apparaît.

### Pour "Installer" l'app (App Native) :

*   **iOS (Safari)** :
    *   Appuyez sur le bouton **Partager** (carré avec une flèche vers le haut).
    *   Descendez et choisissez **"Sur l'écran d'accueil"** (Add to Home Screen).
    *   Validez. L'icône apparaît désormais sur votre écran comme une vraie app.

*   **Android (Chrome)** :
    *   Appuyez sur les **trois points** (menu).
    *   Choisissez **"Ajouter à l'écran d'accueil"** ou "Installer l'application".

## Configuration Avancée

Si vous devez modifier les commandes (ex: profil GoXLR différent), ouvrez `server.ts` avec un éditeur de texte et modifiez les constantes en haut du fichier :

```typescript
const CMD_GOXLR = "goxlr-client load-profile Sleep";
const CMD_SHUTDOWN = "shutdown /s /t 0";
```

## Fonctionnement

L'app est pensée pour programmer une extinction en un minimum de gestes, typiquement le soir avant de regarder une série ou un film :

1.  Ouvrez l'app sur le mobile.
2.  Choisissez une durée en un tap parmi les **suggestions rapides** (ex. "30 min", "1 h", "2 h") — les durées que vous utilisez le plus souvent remontent automatiquement en premier, ou une **heure précise** via le sélecteur d'heure (pré-rempli avec votre dernier choix).
3.  Un compte à rebours s'affiche avec l'heure d'extinction prévue ; vous pouvez l'ajuster (+15 min, +30 min, -15 min) ou l'annuler à tout moment.
4.  À l'heure programmée, le PC s'éteint automatiquement (GoXLR en mode "Sleep" si activé, puis extinction).
5.  Besoin d'éteindre tout de suite ? Le lien **"Éteindre maintenant"** en bas de l'écran révèle un bouton à maintenir enfoncé pour confirmer une extinction immédiate.

L'historique des durées et heures utilisées est stocké localement sur l'appareil (localStorage), rien n'est envoyé ailleurs qu'au PC contrôlé.
