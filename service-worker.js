// Unified service worker combining caching and version logic
const APP_VERSION = '2.15.2';
const CACHE_NAME = 'maladum-event-cards-' + APP_VERSION;

const urlsToCache = [
    // BUILD_ASSET_MANIFEST_START
    './',
    './about.html',
    './app-utils.js',
    './card-actions.js',
    './card-data.mjs',
    './card-renderer.mjs',
    './card-tokenizer.mjs',
    './card-utils.js',
    './config-manager.js',
    './deck-manager.js',
    './deckbuilder.js',
    './difficulties.json',
    './dungeons_of_enveron.html',
    './events.js',
    './forbidden_creed.html',
    './index.html',
    './initialization.js',
    './maladumcards.json',
    './manifest.json',
    './state.js',
    './storage-utils.js',
    './styles.css',
    './ui-manager.js',
    './update-utils.js',
    './version.json',
    './assets/icons/actions.svg',
    './assets/icons/armour.png',
    './assets/icons/arrow-up.png',
    './assets/icons/arrow-up.svg',
    './assets/icons/bludgeoning.png',
    './assets/icons/blue-reminder.svg',
    './assets/icons/camouflage.png',
    './assets/icons/creature.png',
    './assets/icons/denizen.png',
    './assets/icons/enemy.svg',
    './assets/icons/entangling.png',
    './assets/icons/entry-point.png',
    './assets/icons/entry-point.svg',
    './assets/icons/fire.svg',
    './assets/icons/grave.png',
    './assets/icons/grave.svg',
    './assets/icons/hawkeye.png',
    './assets/icons/health.png',
    './assets/icons/larger-area.png',
    './assets/icons/larger-area.svg',
    './assets/icons/malacytic-conduit.png',
    './assets/icons/map.png',
    './assets/icons/map.svg',
    './assets/icons/melee.png',
    './assets/icons/mountain.png',
    './assets/icons/move.svg',
    './assets/icons/night-sight.png',
    './assets/icons/no-defence.png',
    './assets/icons/otherworldly.png',
    './assets/icons/piercing.png',
    './assets/icons/plunderer.png',
    './assets/icons/poison.png',
    './assets/icons/red-reminder.svg',
    './assets/icons/revenant.svg',
    './assets/icons/search.svg',
    './assets/icons/sharp.png',
    './assets/icons/size.png',
    './assets/icons/skull.svg',
    './assets/icons/unknown-icon.svg',
    './assets/icons/wall.png',
    './assets/icons/worthy-opponent.png',
    './assets/icons/yellow-reminder.svg',
    './cardimages/Alarm.jpg',
    './cardimages/Alarm.png',
    './cardimages/Alary.png',
    './cardimages/Ambush.png',
    './cardimages/As_One_Door_Closes.jpg',
    './cardimages/As_One_Door_Closes.png',
    './cardimages/Balefire.jpg',
    './cardimages/Balefire.png',
    './cardimages/Blaze_of_Glory.png',
    './cardimages/Bloodwyrm.png',
    './cardimages/Bounty.png',
    './cardimages/Cankers.png',
    './cardimages/Careless_Swing.png',
    './cardimages/Cave_In.png',
    './cardimages/Chill_Wind.png',
    './cardimages/Chilling_Aura.jpg',
    './cardimages/Chilling_Aura.png',
    './cardimages/Collapse.png',
    './cardimages/Collapsed.png',
    './cardimages/Corrupt_Talisman.png',
    './cardimages/Corrupted_Warrior.png',
    './cardimages/Crack.png',
    './cardimages/Crag_Troll.png',
    './cardimages/Cursed_Chest.png',
    './cardimages/Cursed_Portal.png',
    './cardimages/Cursed_Vestiges.png',
    './cardimages/Dangerous_Ground.png',
    './cardimages/Dead_Ja_Vu.png',
    './cardimages/Deadly_Accuracy.png',
    './cardimages/Death_Draws_In.jpg',
    './cardimages/Death_Draws_In.png',
    './cardimages/Deathly_Avatar.png',
    './cardimages/Deathly_Draught.png',
    './cardimages/Deathly_Fusion.jpg',
    './cardimages/Deathly_Fusion.png',
    './cardimages/Debased_Acolyte.png',
    './cardimages/Dont_Look_Up.png',
    './cardimages/Dormant_Lifeforce.png',
    './cardimages/Drakon.png',
    './cardimages/Drip,_Drip,_Drip.png',
    './cardimages/Drip_Drip_Drip.png',
    './cardimages/Dusk_To_Dawn.png',
    './cardimages/Eldritch_Tentacle.png',
    './cardimages/Escape_Route.png',
    './cardimages/Ethereal_Power.png',
    './cardimages/Excursionist.png',
    './cardimages/Fading_Light.png',
    './cardimages/Falling_Rocks.png',
    './cardimages/Feeling_Lucky.png',
    './cardimages/Fiery_Touch.jpg',
    './cardimages/Fiery_Touch.png',
    './cardimages/Fortune_Favours_The_Grave.png',
    './cardimages/Fresh_Graves.png',
    './cardimages/G-G-G-G-Ghosts.png',
    './cardimages/Get_That_One.jpg',
    './cardimages/Get_That_One.png',
    './cardimages/Get_Them_Off_Me.png',
    './cardimages/Gleaming_Trinket.jpg',
    './cardimages/Gleaming_Trinket.png',
    './cardimages/Great_Bear.png',
    './cardimages/Hall_of_Heroes.png',
    './cardimages/Halls_Of_Veneration.png',
    './cardimages/Heigh_Ho_Heigh_Ho.png',
    './cardimages/High_Alert.png',
    './cardimages/Home_Invasion.png',
    './cardimages/Howling_Gale.png',
    './cardimages/Infiltration.png',
    './cardimages/Its_A_Trap.png',
    './cardimages/Its_Alive.png',
    './cardimages/Its_Behind_You.png',
    './cardimages/Life_Drain.jpg',
    './cardimages/Life_Drain.png',
    './cardimages/Lights_Out.png',
    './cardimages/Lost_Traveller.png',
    './cardimages/Lurching_Forth.png',
    './cardimages/Malaclyte_Fluctuations.png',
    './cardimages/Malacyte_Exhaustion.png',
    './cardimages/Malacyte_Fluctuations.jpg',
    './cardimages/Malacytic_Exhaustion.png',
    './cardimages/Malacytic_Fluctuations.png',
    './cardimages/Malacytic_Scourge.png',
    './cardimages/Malacytic_Surge.png',
    './cardimages/Malacytic_Vigour.png',
    './cardimages/Maladite_Golum.png',
    './cardimages/Nectar_Of_The_Gods.png',
    './cardimages/Nomadic_Trader.png',
    './cardimages/Not_Again.png',
    './cardimages/On_The_Hunt.png',
    './cardimages/One_Thing_After_Another.png',
    './cardimages/Opportunist.png',
    './cardimages/Out_For_Blood.png',
    './cardimages/Outta_My_Way.png',
    './cardimages/Panhandler.png',
    './cardimages/Paradigm_Shift.png',
    './cardimages/Premonition.png',
    './cardimages/Purifying_Aether.png',
    './cardimages/Questgiver.png',
    './cardimages/Reanimation.jpg',
    './cardimages/Reanimation.png',
    './cardimages/Renewed_Vigour.jpg',
    './cardimages/Renewed_Vigour.png',
    './cardimages/Respite.png',
    './cardimages/Rotten_Floor.png',
    './cardimages/Rumours.png',
    './cardimages/Runaway_Train.png',
    './cardimages/Seize_Them.png',
    './cardimages/Shhhhh.png',
    './cardimages/Skin_Shifter.png',
    './cardimages/Snap.png',
    './cardimages/Spitting_Fire.png',
    './cardimages/Split_Tail_Rats.png',
    './cardimages/Spooked.jpg',
    './cardimages/Spooked.png',
    './cardimages/Spurred_On.png',
    './cardimages/Stand_And_Deliver.png',
    './cardimages/Stroke_Of_Fortune.png',
    './cardimages/Sudden_Rot.png',
    './cardimages/Summon_The_Master.png',
    './cardimages/Teamwork.png',
    './cardimages/The_Cabal.png',
    './cardimages/The_Floodgates_Open.png',
    './cardimages/There_Everywhere.jpg',
    './cardimages/There_Everywhere.png',
    './cardimages/They_Are_Coming.png',
    './cardimages/Theyre_Below_Us.jpg',
    './cardimages/Theyre_Below_Us.png',
    './cardimages/Theyre_Everywhere.png',
    './cardimages/Theyre_In_The_Walls.png',
    './cardimages/Thunderstorm.png',
    './cardimages/Touched_By_Darkness.png',
    './cardimages/Toxic_Waste.png',
    './cardimages/Trap_Acid_Mist.png',
    './cardimages/Trap_Ancient_Wards.png',
    './cardimages/Trap_Arrow.png',
    './cardimages/Trap_Caltrops.png',
    './cardimages/Trap_Crushing_Ceiling.png',
    './cardimages/Trap_Deadfall.png',
    './cardimages/Trap_Fireball.png',
    './cardimages/Trap_Net.png',
    './cardimages/Trap_Pit.png',
    './cardimages/Trap_Poison_Gas.png',
    './cardimages/Trap_Snare.jpg',
    './cardimages/Trap_Snare.png',
    './cardimages/Trap_Swinging_Blade.png',
    './cardimages/Trap_Swining_Blade.png',
    './cardimages/Trap_Wall_of_Fire.png',
    './cardimages/Treacherous_Terrain.png',
    './cardimages/Tremors.jpg',
    './cardimages/Tremors.png',
    './cardimages/Troglodyte.png',
    './cardimages/Tsewer_Nami.png',
    './cardimages/Unexpected_Assault.png',
    './cardimages/Unmasked.png',
    './cardimages/Unnatural_Lifeforce.jpg',
    './cardimages/Unnatural_Lifeforce.png',
    './cardimages/Wanderer.png',
    './cardimages/Watch_Your_Step.png',
    './cardimages/Wave_of_Exhaustion.png',
    './cardimages/Where_Did_I_Put_That.png',
    './cardimages/back.jpg',
    './data/cards/base-game.json',
    './data/cards/beasts-of-environ.json',
    './data/cards/beyond-the-vaults.json',
    './data/cards/extraction-report.json',
    './data/cards/forbidden-creed.json',
    './data/cards/icons.json',
    './data/cards/manifest.json',
    './data/cards/oblivion-s-maw.json',
    './data/cards/of-ale-and-adventure.json',
    './data/cards/revenant-retribution.json',
    './icons/icon-152x152.png',
    './icons/icon-167x167.png',
    './icons/icon-180x180.png',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    './logos/Cabal.jpg',
    './logos/Corrupter.jpg',
    './logos/Denizen.jpg',
    './logos/Dungeon.jpg',
    './logos/Environment.jpg',
    './logos/Location.jpg',
    './logos/Malagaunt.jpg',
    './logos/Mountain.jpg',
    './logos/Novice.jpg',
    './logos/Otherwordly.jpg',
    './logos/Revenant.jpg',
    './logos/Revenants.jpg',
    './logos/Veteran.jpg',
    './logos/WanderingBeast.jpg',
    './logos/background.png',
    './logos/gameicon.jpg',
    './logos/header.jpg',
    './logos/stone-button.png',
    './vendor/bootstrap/css/bootstrap.min.css',
    './vendor/bootstrap/js/bootstrap.bundle.min.js',
    './vendor/fontawesome/css/all.min.css',
    './vendor/fontawesome/webfonts/fa-brands-400.ttf',
    './vendor/fontawesome/webfonts/fa-brands-400.woff2',
    './vendor/fontawesome/webfonts/fa-regular-400.ttf',
    './vendor/fontawesome/webfonts/fa-regular-400.woff2',
    './vendor/fontawesome/webfonts/fa-solid-900.ttf',
    './vendor/fontawesome/webfonts/fa-solid-900.woff2',
    './vendor/fontawesome/webfonts/fa-v4compatibility.ttf',
    './vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
    './vendor/fonts/cinzel-latin-400-normal.woff2',
    './vendor/fonts/cinzel-latin-700-normal.woff2',
    // BUILD_ASSET_MANIFEST_END
];

function compareVersions(leftVersion, rightVersion) {
    const leftParts = String(leftVersion || '').split('.').map(part => parseInt(part, 10));
    const rightParts = String(rightVersion || '').split('.').map(part => parseInt(part, 10));
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index++) {
        const left = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
        const right = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
        if (left !== right) {
            return left - right;
        }
    }

    return 0;
}

self.addEventListener('message', (event) => {
    if (event.data === 'GET_VERSION') {
        event.ports[0].postMessage(APP_VERSION);
    }
});

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(names => Promise.all(names.map(name => {
                if (name !== CACHE_NAME) {
                    return caches.delete(name);
                }
            }))),
            fetch('./version.json?nocache=' + Date.now())
                .then(resp => resp.json())
                .then(data => {
                    if (compareVersions(data.version, APP_VERSION) > 0) {
                        self.clients.matchAll().then(clients => {
                            clients.forEach(client => client.postMessage({ type: 'NEW_VERSION', version: data.version }));
                        });
                    }
                })
                .catch(() => { })
        ]).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    if (requestUrl.hostname.includes('google-analytics.com') || requestUrl.hostname.includes('googletagmanager.com')) {
        event.respondWith(
            fetch(event.request).catch(() => new Response('', { status: 204, statusText: 'No Content' }))
        );
        return;
    }

    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }

            return fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });
        })
    );
});
