// Replace with actual API Gateway URL after CDK deployment
const API_URL = "https://4z2cv12blg.execute-api.ap-south-1.amazonaws.com/prod/api/v1";

// --- Tab Switching ---
const btnUpload = document.getElementById('btn-upload');
const btnDiscover = document.getElementById('btn-discover');
const sectionUpload = document.getElementById('upload-section');
const sectionDiscover = document.getElementById('discovery-section');

btnUpload.addEventListener('click', () => {
    btnUpload.classList.add('active');
    btnDiscover.classList.remove('active');
    sectionUpload.classList.add('active-section');
    sectionUpload.classList.remove('hidden');
    sectionDiscover.classList.add('hidden');
    sectionDiscover.classList.remove('active-section');
});

btnDiscover.addEventListener('click', () => {
    btnDiscover.classList.add('active');
    btnUpload.classList.remove('active');
    sectionDiscover.classList.add('active-section');
    sectionDiscover.classList.remove('hidden');
    sectionUpload.classList.add('hidden');
    sectionUpload.classList.remove('active-section');
    loadDiscoveryFeed();
});

// --- File Input Validation ---
const audioInput = document.getElementById('audio-file');
const submitBtn = document.getElementById('submit-btn');

audioInput.addEventListener('change', () => {
    submitBtn.disabled = !audioInput.files.length;
});

// --- Upload Flow ---
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    document.querySelector('.btn-text').classList.add('hidden');
    document.querySelector('.loader').classList.remove('hidden');

    const statusBox = document.getElementById('upload-status');
    statusBox.classList.remove('hidden');
    statusBox.textContent = "Requesting secure uplink...";

    try {
        const file = audioInput.files[0];
        const community = document.getElementById('community').value;
        const language = document.getElementById('language').value;
        const musicType = document.getElementById('musicType').value;
        const lyrics = document.getElementById('lyrics').value;

        // Collect checked licenses
        const licenseTypes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        // 1. Get Pre-signed URL
        const urlRes = await fetch(`${API_URL}/assets/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, contentType: file.type })
        });
        const { assetId, uploadUrl } = await urlRes.json();

        // 2. Upload directly to S3 (bypassing API Gateway limit)
        statusBox.textContent = "Uploading master audio to private bucket...";
        await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });

        // 3. Register Metadata
        statusBox.textContent = "Writing immutable ledger state...";
        await fetch(`${API_URL}/assets/metadata`, {
            method: 'POST',
            body: JSON.stringify({
                assetId, community, language, musicType, lyrics,
                licensable: true, licenseTypes
            })
        });

        statusBox.innerHTML = `✅ Successfully registered on QLDB.<br>Asset ID: <span class="mono">${assetId}</span>`;
        document.getElementById('upload-form').reset();
    } catch (err) {
        console.error(err);
        statusBox.style.color = "#ef4444";
        statusBox.textContent = "Error: " + err.message;
    } finally {
        submitBtn.disabled = true;
        document.querySelector('.btn-text').classList.remove('hidden');
        document.querySelector('.loader').classList.add('hidden');
    }
});

// --- Discovery Feed Flow ---
document.getElementById('refresh-feed').addEventListener('click', loadDiscoveryFeed);

async function loadDiscoveryFeed() {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = '<div class="loader"></div>';

    try {
        const res = await fetch(`${API_URL}/assets/public`);
        const assets = await res.json();

        feedContainer.innerHTML = '';
        if (assets.length === 0) {
            feedContainer.innerHTML = '<p style="color:var(--text-muted)">No public assets found.</p>';
            return;
        }

        assets.forEach(asset => {
            const card = document.createElement('div');
            card.className = 'feed-item glass-card';

            const tagsHtml = (asset.licenseTypes || []).map(t => `<span>${t}</span>`).join('');

            card.innerHTML = `
                <div class="feed-community">${asset.community}</div>
                <div class="feed-meta">${asset.musicType} • ${asset.language}</div>
                <div class="feed-tags">${tagsHtml}</div>
                <button class="play-btn" onclick="playAsset('${asset.assetId}', this)">▶ Play 30s Preview</button>
                <button class="prov-btn" onclick="viewProvenance('${asset.assetId}')">Verify QLDB Provenance</button>
            `;
            feedContainer.appendChild(card);
        });
    } catch (e) {
        feedContainer.innerHTML = '<p style="color:#ef4444">Error loading ledger: Set API_URL in app.js after `cdk deploy`.</p>';
    }
}

// --- Play Audio ---
const activeAudioPlayers = {};

async function playAsset(assetId, btnElement) {
    if (activeAudioPlayers[assetId]) {
        const audio = activeAudioPlayers[assetId];
        if (audio.paused) {
            audio.play();
            btnElement.textContent = '⏸ Pause Preview';
        } else {
            audio.pause();
            btnElement.textContent = '▶ Play Preview';
        }
        return;
    }

    try {
        btnElement.textContent = '⏳ Loading...';
        const res = await fetch(`${API_URL}/assets/${assetId}/play`);
        if (!res.ok) throw new Error("Audio processing");
        const { previewUrl } = await res.json();

        const audio = new Audio(previewUrl);
        activeAudioPlayers[assetId] = audio;

        audio.addEventListener('ended', () => {
            btnElement.textContent = '▶ Play Preview';
        });

        audio.play();
        btnElement.textContent = '⏸ Pause Preview';
    } catch (e) {
        alert("Audio still processing or unavailable.");
        btnElement.textContent = '▶ Play Preview';
    }
}

// --- Provenance Modal ---
const modal = document.getElementById('provenance-modal');
const closeBtn = document.querySelector('.close-btn');

closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
});

async function viewProvenance(assetId) {
    modal.classList.remove('hidden');
    document.getElementById('prov-id').textContent = 'Loading...';
    document.getElementById('prov-time').textContent = '...';
    document.getElementById('prov-fingerprint').textContent = '...';
    document.getElementById('prov-audio').textContent = '...';
    document.getElementById('prov-community').textContent = '...';

    try {
        const res = await fetch(`${API_URL}/assets/${assetId}/provenance`);
        const data = await res.json();

        if (data.provenance) {
            document.getElementById('prov-id').textContent = data.provenance.assetId;
            document.getElementById('prov-time').textContent = data.provenance.timestamp;
            document.getElementById('prov-fingerprint').textContent = data.provenance.fingerprintHash || "Processing...";
            document.getElementById('prov-audio').textContent = data.provenance.audioHash || "Processing...";
            document.getElementById('prov-community').textContent = data.provenance.community;
        }
    } catch (e) {
        document.getElementById('prov-id').textContent = "Error fetching from QLDB ledger.";
    }
}
