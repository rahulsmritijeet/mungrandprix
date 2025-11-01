// API Configuration
const API_URL = 'http://localhost:3000/api';

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Fetch portfolio data from server
async function fetchPortfolioData() {
    try {
        const response = await fetch(`${API_URL}/portfolios`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching portfolios:', error);
        // Fallback to local data if server is down
        return null;
    }
}

// Populate UNGA table
async function populateUNGA(portfolioData) {
    const tbody = document.getElementById('unga-tbody');
    tbody.innerHTML = '';
    
    if (!portfolioData || !portfolioData.UNGA) return;
    
    portfolioData.UNGA.forEach((country, index) => {
        const statusClass = country.status === 'Confirmed' ? 'status-confirmed' : 
                           country.status === 'Allotted' ? 'status-occupied' : 
                           'status-available';
        
        const displayStatus = country.delegate ? 
            `${country.status} - ${country.delegate}` : country.status;
        
        const row = `
            <tr class="${statusClass}">
                <td class="serial-no">${index + 1}</td>
                <td>${country.name}</td>
                <td>${displayStatus}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Populate UNSC table
async function populateUNSC(portfolioData) {
    const tbody = document.getElementById('unsc-tbody');
    tbody.innerHTML = '';
    
    if (!portfolioData || !portfolioData.UNSC) return;
    
    portfolioData.UNSC.forEach((country, index) => {
        const statusClass = country.status === 'Confirmed' ? 'status-confirmed' : 
                           country.status === 'Allotted' ? 'status-occupied' : 
                           'status-available';
        
        const displayStatus = country.delegate ? 
            `${country.status} - ${country.delegate}` : country.status;
        
        const row = `
            <tr class="${statusClass}">
                <td class="serial-no">${index + 1}</td>
                <td>${country.name}</td>
                <td>${country.type}</td>
                <td>${displayStatus}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Populate UNHRC table
async function populateUNHRC(portfolioData) {
    const tbody = document.getElementById('unhrc-tbody');
    tbody.innerHTML = '';
    
    if (!portfolioData || !portfolioData.UNHRC) return;
    
    portfolioData.UNHRC.forEach((country, index) => {
        const statusClass = country.status === 'Confirmed' ? 'status-confirmed' : 
                           country.status === 'Allotted' ? 'status-occupied' : 
                           'status-available';
        
        const displayStatus = country.delegate ? 
            `${country.status} - ${country.delegate}` : country.status;
        
        const row = `
            <tr class="${statusClass}">
                <td class="serial-no">${index + 1}</td>
                <td>${country.name}</td>
                <td>${country.region}</td>
                <td>${displayStatus}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Populate UNCSW table
async function populateUNCSW(portfolioData) {
    const tbody = document.getElementById('uncsw-tbody');
    tbody.innerHTML = '';
    
    if (!portfolioData || !portfolioData.UNCSW) return;
    
    portfolioData.UNCSW.forEach((country, index) => {
        const statusClass = country.status === 'Confirmed' ? 'status-confirmed' : 
                           country.status === 'Allotted' ? 'status-occupied' : 
                           'status-available';
        
        const displayStatus = country.delegate ? 
            `${country.status} - ${country.delegate}` : country.status;
        
        const row = `
            <tr class="${statusClass}">
                <td class="serial-no">${index + 1}</td>
                <td>${country.name}</td>
                <td>${country.region}</td>
                <td>${displayStatus}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Populate WHO table
async function populateWHO(portfolioData) {
    const tbody = document.getElementById('who-tbody');
    tbody.innerHTML = '';
    
    if (!portfolioData || !portfolioData.WHO) return;
    
    portfolioData.WHO.forEach((country, index) => {
        const statusClass = country.status === 'Confirmed' ? 'status-confirmed' : 
                           country.status === 'Allotted' ? 'status-occupied' : 
                           'status-available';
        
        const displayStatus = country.delegate ? 
            `${country.status} - ${country.delegate}` : country.status;
        
        const row = `
            <tr class="${statusClass}">
                <td class="serial-no">${index + 1}</td>
                <td>${country.name}</td>
                <td>${displayStatus}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Populate MoM tables
async function populateMoM(portfolioData) {
    if (!portfolioData || !portfolioData.MOM) return;
    
    // Mapping between department keys and HTML tbody IDs
    const deptMapping = {
        'auror': 'auror-tbody',
        'mysteries': 'mysteries-tbody',
        'law': 'law-tbody',
        'games': 'games-tbody',
        'wizengamot': 'wizengamot-tbody'
    };
    
    Object.entries(deptMapping).forEach(([dept, tbodyId]) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody || !portfolioData.MOM[dept]) return;
        
        tbody.innerHTML = '';
        
        portfolioData.MOM[dept].forEach((member, index) => {
            const statusClass = member.status === 'Confirmed' ? 'status-confirmed' : 
                               member.status === 'Allotted' ? 'status-occupied' : 
                               'status-available';
            
            const displayStatus = member.delegate ? 
                `${member.status} - ${member.delegate}` : member.status;
            
            const row = `
                <tr class="${statusClass}">
                    <td class="serial-no">${index + 1}</td>
                    <td>${member.name}</td>
                    <td>${member.position || member.division || member.department || member.sport || ''}</td>
                    <td>${displayStatus}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}

// Populate AIPPM tables
async function populateAIPPM(portfolioData) {
    if (!portfolioData || !portfolioData.AIPPM) return;
    
    const parties = ['bjp', 'inc', 'aap', 'tmc', 'dmk', 'sp', 'bsp', 'ncp', 'cpi', 'tdp'];
    
    parties.forEach(party => {
        const tbody = document.getElementById(`${party}-tbody`);
        if (!tbody || !portfolioData.AIPPM[party]) return;
        
        tbody.innerHTML = '';
        
        portfolioData.AIPPM[party].forEach((member, index) => {
            const statusClass = member.status === 'Confirmed' ? 'status-confirmed' : 
                               member.status === 'Allotted' ? 'status-occupied' : 
                               'status-available';
            
            const displayStatus = member.delegate ? 
                `${member.status} - ${member.delegate}` : member.status;
            
            const row = `
                <tr class="${statusClass}">
                    <td class="serial-no">${index + 1}</td>
                    <td>${member.name}</td>
                    <td>${member.position}</td>
                    <td>${displayStatus}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
}

// Refresh all data
async function refreshAllData() {
    const portfolioData = await fetchPortfolioData();
    if (!portfolioData) return;
    
    await Promise.all([
        populateUNGA(portfolioData),
        populateUNSC(portfolioData),
        populateUNHRC(portfolioData),
        populateUNCSW(portfolioData),
        populateWHO(portfolioData),
        populateMoM(portfolioData),
        populateAIPPM(portfolioData)
    ]);
}

// Show main committee tab
function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    selectedTab.style.display = 'block';
    setTimeout(() => {
        selectedTab.classList.add('active');
    }, 10);
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Refresh data when tab changes
    refreshAllData();
}

// Show sub-tab (for MoM and AIPPM)
function showSubTab(subTabId, parentTab) {
    const parent = document.getElementById(parentTab);
    
    // Hide all sub-tabs
    parent.querySelectorAll('.sub-tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    
    // Remove active class from all sub-tab buttons
    parent.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected sub-tab
    const selectedSubTab = document.getElementById(subTabId);
    selectedSubTab.style.display = 'block';
    setTimeout(() => {
        selectedSubTab.classList.add('active');
    }, 10);
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Create particles effect
    createParticles();
    
    // Load initial data
    refreshAllData();
    
    // Set up auto-refresh every 5 seconds
    setInterval(refreshAllData, 5000);
});

// Listen for visibility change to pause/resume refresh when tab is not visible
let refreshInterval;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(refreshInterval);
    } else {
        refreshAllData();
        refreshInterval = setInterval(refreshAllData, 5000);
    }
});

// Export functions for use in HTML
window.showTab = showTab;
window.showSubTab = showSubTab;