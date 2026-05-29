document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('listings-grid');
    const searchInput = document.getElementById('search-input');
    const resultsCount = document.getElementById('results-count');
    const cityFiltersContainer = document.getElementById('city-filters');
    let allData = [];
    let activeCity = 'Todas'; // 'Todas' means no city filter
    let currentSearchTerm = '';

    // Fetch data from JSON
    async function loadData() {
        try {
            const response = await fetch('./data.json');
            if (!response.ok) throw new Error('No se pudo cargar el archivo data.json');
            
            allData = await response.json();
            
            // Generate city pills
            renderCityPills(allData);
            
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

    function renderCityPills(data) {
        // Get unique cities
        const cities = new Set(data.map(item => item.location));
        const sortedCities = Array.from(cities).sort();
        
        cityFiltersContainer.innerHTML = '';
        
        // Add "Todas" pill
        const allPill = document.createElement('button');
        allPill.className = 'pill active';
        allPill.textContent = 'Todas';
        allPill.addEventListener('click', () => {
            activeCity = 'Todas';
            updateActivePill();
            filterAndRender();
        });
        cityFiltersContainer.appendChild(allPill);
        
        // Add specific city pills
        sortedCities.forEach(city => {
            const pill = document.createElement('button');
            pill.className = 'pill';
            pill.textContent = city;
            pill.addEventListener('click', () => {
                activeCity = city;
                updateActivePill();
                filterAndRender();
            });
            cityFiltersContainer.appendChild(pill);
        });
    }

    function updateActivePill() {
        const pills = cityFiltersContainer.querySelectorAll('.pill');
        pills.forEach(pill => {
            if (pill.textContent === activeCity) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    function filterAndRender() {
        const filtered = allData.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(currentSearchTerm) ||
                                  item.description.toLowerCase().includes(currentSearchTerm) ||
                                  item.location.toLowerCase().includes(currentSearchTerm);
                                  
            const matchesCity = activeCity === 'Todas' || item.location === activeCity;
            
            return matchesSearch && matchesCity;
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
            card.innerHTML = `
                <div class="card-image-placeholder">
                    ${item.area_m2} m²
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <span class="card-price">${item.price.toLocaleString('es-ES')} ${item.currency}</span>
                        <span class="card-area">${item.area_m2} m²</span>
                    </div>
                    <h2 class="card-title">${item.title}</h2>
                    <div class="card-location">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${item.location}
                    </div>
                    <p class="card-description">${item.description}</p>
                    <div class="card-footer">
                        <span class="card-date">${date}</span>
                        <a href="${item.url}" class="btn" target="_blank" rel="noopener noreferrer">Ver detalle</a>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    loadData();
});
