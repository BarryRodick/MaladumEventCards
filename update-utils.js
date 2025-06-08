export function showUpdateNotification(newVersion) {
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
                        <p>A new version (${newVersion}) of the app is available.</p>
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
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', updateModal);
    const modal = $('#updateModal');
    modal.modal('show');

    document.getElementById('updateNowButton').addEventListener('click', () => {
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                window.location.reload();
            });
        } else {
            window.location.reload();
        }
    });
}

if (typeof window !== 'undefined') {
    window.showUpdateNotification = showUpdateNotification;
}
