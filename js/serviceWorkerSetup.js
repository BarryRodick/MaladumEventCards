// js/serviceWorkerSetup.js

// Function to show an update notification to the user (remains internal)
function showUpdateNotification(newVersion) {
    const versionText = newVersion ? `(${newVersion})` : '(New Update)';
    const updateModal = `
        <div class="modal fade" id="updateModal" tabindex="-1" role="dialog" aria-labelledby="updateModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="updateModalLabel">New Version Available</h5>
                        <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>A new version ${versionText} of the app is available.</p>
                        <p>Update now to get the latest features and improvements.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Later</button>
                        <button type="button" class="btn btn-primary" id="updateNowButton">Update Now</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('updateModal');
    if (existingModal) {
        // Bootstrap's modal('hide') might be better if it's a Bootstrap modal
        $(existingModal).modal('hide'); // Assuming jQuery and Bootstrap modal
        existingModal.remove(); // Ensure it's removed from DOM after hide
    }
    
    document.body.insertAdjacentHTML('beforeend', updateModal);
    const modalElement = document.getElementById('updateModal');
    const modal = $(modalElement); // Assuming jQuery for Bootstrap modal
    modal.modal('show');

    const updateNowButton = document.getElementById('updateNowButton');
    if (updateNowButton) {
        updateNowButton.addEventListener('click', () => {
            if ('caches' in window) {
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                }).then(() => {
                    window.location.reload(true); // Force reload
                });
            } else {
                window.location.reload(true); // Force reload
            }
        });
    }
}

export function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);

                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        console.log('New content is available; please refresh.');
                                        showUpdateNotification('New content installed'); 
                                    } else {
                                        console.log('Content is cached for offline use.');
                                    }
                                }
                            };
                        }
                    };
                }, (err) => {
                    console.error('Service Worker registration failed:', err);
                });
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NEW_VERSION') {
                showUpdateNotification(event.data.version);
            }
        });
    }
}
