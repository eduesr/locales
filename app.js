document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('listings-grid');
    const searchInput = document.getElementById('search-input');
    const resultsCount = document.getElementById('results-count');
    const cityFiltersContainer = document.getElementById('city-filters');
    const regionTabs = document.querySelectorAll('.region-tab');
    
    // Elementos del menú móvil
    const meatballBtn = document.getElementById('meatball-btn');
    const mobileDropdown = document.getElementById('mobile-dropdown');
    
    if (meatballBtn && mobileDropdown) {
        meatballBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', () => {
            mobileDropdown.classList.remove('show');
        });
    }

    let allData = [];
    let activeRegion = null; // Default will be set dynamically
    let currentSearchTerm = '';

    // Initialize Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyAIkbnUCLqSY1lS_lcuCbtMMPgPXA0Ppy8",
      authDomain: "locales-c8807.firebaseapp.com",
      databaseURL: "https://locales-c8807-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "locales-c8807",
      storageBucket: "locales-c8807.firebasestorage.app",
      messagingSenderId: "593455969500",
      appId: "1:593455969500:web:7d3c03399141b035343019",
      measurementId: "G-EB8CSV6H5V"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    
    // Discard logic with Firebase
    let discardedUrls = [];
    const discardsRef = db.ref('discards');
    
    // Safely encode URL for Firebase key (no ., $, #, [, ], /)
    const encodeKey = (url) => encodeURIComponent(url).replace(/\./g, '%2E');
    const decodeKey = (key) => decodeURIComponent(key.replace(/%2E/g, '.'));

    discardsRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        discardedUrls = Object.keys(data).filter(k => data[k]).map(k => {
            try { return decodeKey(k); } catch(e) { return k; }
        });
        
        if (allData.length > 0) {
            filterAndRender();
        }
    });

    // Modal elements
    const confirmModal = document.getElementById('confirm-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    let urlToDiscard = null;

    modalCancel.addEventListener('click', () => {
        confirmModal.classList.remove('active');
        urlToDiscard = null;
    });

    modalConfirm.addEventListener('click', () => {
        if (urlToDiscard) {
            const key = encodeKey(urlToDiscard);
            db.ref('discards/' + key).set(true)
              .catch(err => alert("Error de conexión con la base de datos. Comprueba las Reglas de Firebase."));
            confirmModal.classList.remove('active');
            urlToDiscard = null;
        }
    });

    window.toggleDiscard = (id) => {
        const item = allData.find(i => i.id === id);
        if (!item) return;
        const url = item.url;
        
        if (discardedUrls.includes(url)) {
            const key = encodeKey(url);
            db.ref('discards/' + key).remove();
        } else {
            urlToDiscard = url; // guardamos la url original intacta
            confirmModal.classList.add('active');
        }
    };

    // Fetch data from JSON
    async function loadData() {
        try {
            const response = await fetch('./data.json');
            if (!response.ok) throw new Error('No se pudo cargar el archivo data.json');
            
            allData = await response.json();
            
            // Generate dynamic region tabs
            const dynamicTabsContainer = document.getElementById('region-selector');
            if (dynamicTabsContainer) {
                // Get unique regions
                const uniqueRegions = new Set(allData.map(item => item.region));
                const sortedRegions = Array.from(uniqueRegions).sort();
                
                // Set first region as active by default if none is set
                if (!activeRegion && sortedRegions.length > 0) {
                    activeRegion = sortedRegions[0];
                }

                // Add dynamic region buttons
                sortedRegions.forEach(region => {
                    const btn = document.createElement('button');
                    btn.className = `region-tab ${region === activeRegion ? 'active' : ''}`;
                    btn.dataset.region = region;
                    btn.innerHTML = `Área de <strong class="mobile-break">${region}</strong>`;
                    dynamicTabsContainer.appendChild(btn);
                });

                // Add "Descartados" button at the end (desktop only)
                const descartadosBtn = document.createElement('button');
                descartadosBtn.className = `region-tab desktop-only ${activeRegion === 'Descartados' ? 'active' : ''}`;
                descartadosBtn.dataset.region = 'Descartados';
                descartadosBtn.textContent = 'Oso descartados 🐻';
                dynamicTabsContainer.appendChild(descartadosBtn);
                
                // Add event listeners to newly created tabs
                document.querySelectorAll('.region-tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        const selectedRegion = e.currentTarget.dataset.region;
                        activeRegion = selectedRegion;
                        
                        document.querySelectorAll('.region-tab').forEach(t => {
                            t.classList.toggle('active', t.dataset.region === selectedRegion);
                        });
                        
                        if (mobileDropdown) {
                            mobileDropdown.classList.remove('show');
                        }
                        
                        filterAndRender();
                    });
                });
            }
            
            // Initial render
            filterAndRender();
            
            // Add search event listener
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value.toLowerCase();
                filterAndRender();
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            grid.innerHTML = `<div class="loader" style="color: #ef4444;">Error al cargar los datos: ${error.message}</div>`;
        }
    }

    function filterAndRender() {
        const filtered = allData.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(currentSearchTerm) ||
                                  item.description.toLowerCase().includes(currentSearchTerm) ||
                                  item.location.toLowerCase().includes(currentSearchTerm);
                                  
            let matchesRegion = false;
            if (activeRegion === 'Descartados') {
                matchesRegion = discardedUrls.includes(item.url);
            } else {
                matchesRegion = item.region === activeRegion && !discardedUrls.includes(item.url);
            }
            
            return matchesSearch && matchesRegion;
        });
        renderListings(filtered);
    }

    function renderListings(data) {
        grid.innerHTML = '';
        resultsCount.textContent = `${data.length} local${data.length !== 1 ? 'es' : ''} encontrado${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            grid.innerHTML = '<div class="loader">No se encontraron resultados para tu búsqueda.</div>';
            return;
        }

        data.forEach(item => {
            const date = new Date(item.date).toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });

            const card = document.createElement('article');
            card.className = 'card';
            const sourceBadge = item.source && item.source !== 'Otro' ? `<span class="card-badge badge-${item.source.toLowerCase()}">${item.source}</span>` : '';
            
            const imageHtml = item.image_url 
                ? `<div class="card-image" style="background-image: url('${item.image_url}')">${sourceBadge}</div>`
                : `<div class="card-image-placeholder">${sourceBadge}</div>`;

            card.innerHTML = `
                ${imageHtml}
                <div class="card-content">
                    <div class="card-header">
                        <span class="card-price">${item.price.toLocaleString('es-ES')} ${item.currency}</span>
                        <span class="card-area">${item.area_m2} m²</span>
                    </div>
                    <h2 class="card-title">${item.title}</h2>
                    <span class="card-date">${date}</span>
                    <div class="card-location">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${item.location}
                    </div>
                    <p class="card-description">${item.description}</p>
                    <div class="card-footer">
                        <div class="card-actions">
                            <button class="btn btn-discard" onclick="window.toggleDiscard('${item.id}')" style="background-color: ${discardedUrls.includes(item.url) ? '#10b981' : '#ef4444'};">${discardedUrls.includes(item.url) ? 'Recuperar 🐻' : 'Descartar 🐻'}</button>
                            <a href="${item.url}" class="btn" target="_blank" rel="noopener noreferrer">Ver detalle</a>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    loadData();
});
