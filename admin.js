// admin.js - Fixed Admin Panel

// API base URL
const API_URL = 'http://localhost:3000/api';

// Load registrations
async function loadRegistrations() {
    try {
        // Try backend first
        const response = await fetch(`${API_URL}/registrations`);
        if (response.ok) {
            const registrations = await response.json();
            localStorage.setItem('munRegistrations', JSON.stringify(registrations));
            displayRegistrations(registrations);
            updateStats(registrations);
        } else {
            throw new Error('Backend not available');
        }
    } catch (error) {
        console.log('Loading from localStorage:', error.message);
        // Fallback to localStorage
        const localRegistrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
        displayRegistrations(localRegistrations);
        updateStats(localRegistrations);
    }
}

// Filter table
function filterTable() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const committeeFilter = document.getElementById('committeeFilter').value;
    
    const registrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
    
    const filtered = registrations.filter(reg => {
        const matchesSearch = !searchInput || 
            reg.name.toLowerCase().includes(searchInput) ||
            reg.email.toLowerCase().includes(searchInput) ||
            reg.institution.toLowerCase().includes(searchInput);
        
        const matchesStatus = !statusFilter || 
            (reg.allocation?.status || 'Pending') === statusFilter;
        
        const matchesCommittee = !committeeFilter || 
            reg.allocation?.committee === committeeFilter ||
            reg.preferences?.preference1?.committee === committeeFilter ||
            reg.preferences?.preference2?.committee === committeeFilter ||
            reg.preferences?.preference3?.committee === committeeFilter;
        
        return matchesSearch && matchesStatus && matchesCommittee;
    });
    
    displayRegistrations(filtered);
}

// Export to CSV
function exportToCSV() {
    const registrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
    
    const csvContent = [
        ['Name', 'Email', 'Phone', 'Institution', 'MUNs Attended', 'Best Delegate', 'Special Mention', 'Verbal Mention', 'Committee', 'Portfolio', 'Status'],
        ...registrations.map(reg => [
            reg.name,
            reg.email,
            reg.phone,
            reg.institution,
            reg.experience,
            reg.bestDelegate || 0,
            reg.specialMention || 0,
            reg.verbalMention || 0,
            reg.allocation?.committee || 'Not Allotted',
            reg.allocation?.portfolio || 'Not Allotted',
            reg.allocation?.status || 'Pending'
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mun_registrations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Display registrations in table
function displayRegistrations(registrations) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    if (registrations.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No registrations found</td></tr>';
        return;
    }
    
    registrations.forEach((reg, index) => {
        // Generate unique ID if not present
        if (!reg.id) {
            reg.id = `reg_${Date.now()}_${index}`;
        }
        
        // Format portfolio display
        let portfolioDisplay = 'Not Allotted';
        if (reg.allocation && reg.allocation.portfolio) {
            portfolioDisplay = `${reg.allocation.committee} - ${reg.allocation.portfolio}`;
            if (reg.allocation.subCommittee) {
                portfolioDisplay = `${reg.allocation.committee}(${reg.allocation.subCommittee}) - ${reg.allocation.portfolio}`;
            }
        }
        
        // Status badge
        const status = reg.allocation?.status || 'Pending';
        const statusClass = `status-${status.toLowerCase()}`;
        
        // Main row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <button class="expand-btn" onclick="toggleExpand('${reg.id}')">
                    <span id="expand-icon-${reg.id}">▶</span>
                </button>
            </td>
            <td>${reg.name}</td>
            <td>${reg.email}</td>
            <td>${reg.phone}</td>
            <td>${reg.institution}</td>
            <td>${reg.experience}</td>
            <td>${portfolioDisplay}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${status}
                </span>
            </td>
            <td>
                ${getActionButton(reg, status)}
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Expanded details row
        const detailsRow = document.createElement('tr');
        detailsRow.innerHTML = `
            <td colspan="9">
                <div class="expanded-details" id="details-${reg.id}">
                    ${generateExpandedDetails(reg)}
                </div>
            </td>
        `;
        tableBody.appendChild(detailsRow);
    });
}

// Get appropriate action button
function getActionButton(reg, status) {
    switch(status) {
        case 'Allotted':
            return `<button class="email-btn" onclick="sendReminderEmail('${reg.id}')">📧 Remind</button>`;
        case 'Confirmed':
            return `<button class="email-btn" onclick="resendConfirmation('${reg.id}')">📧 Receipt</button>`;
        default:
            return `<button class="email-btn" onclick="viewPreferences('${reg.id}')">View</button>`;
    }
}

// Generate expanded details
function generateExpandedDetails(reg) {
    const totalPoints = calculateUserPoints(reg);
    
    let html = '<div class="expanded-content">';
    
    // Preferences section
    html += '<div class="section"><h4>📋 Preferences & Eligibility:</h4>';
    for (let i = 1; i <= 3; i++) {
        const pref = reg.preferences?.[`preference${i}`];
        if (pref && pref.committee && pref.portfolio) {
            const eligibility = getPortfolioTierAndEligibility(pref.portfolio, pref.committee, reg);
            html += `
                <div class="preference-card">
                    <div class="pref-header">
                        <div>
                            <strong>Preference ${i}:</strong> ${pref.committee} - ${pref.portfolio}
                            <div class="eligibility-status ${eligibility.isEligible ? 'eligible' : 'not-eligible'}">
                                ${eligibility.isEligible ? 
                                    `✅ Eligible (Tier ${eligibility.tier})` : 
                                    `❌ Requires ${eligibility.requiredExperience}+ MUNs, ${eligibility.requiredBestDelegates}+ Best Delegates`}
                            </div>
                        </div>
                        ${!reg.allocation?.portfolio && eligibility.isEligible ? 
                            `<button class="allot-btn" onclick="allotPortfolio('${reg.id}', '${pref.committee}', '${pref.portfolio}', ${i})">
                                Allot This
                            </button>` : ''}
                    </div>
                </div>
            `;
        }
    }
    html += '</div>';
    
    // Awards section
    html += `
        <div class="section">
            <h4>🏆 Awards & Experience:</h4>
            <div class="awards-grid">
                <div class="award-item">
                    <span class="award-label">MUNs Attended:</span>
                    <span class="award-value">${reg.experience}</span>
                </div>
                <div class="award-item">
                    <span class="award-label">Best Delegate:</span>
                    <span class="award-value">${reg.bestDelegate || 0}</span>
                </div>
                <div class="award-item">
                    <span class="award-label">Special Mention:</span>
                    <span class="award-value">${reg.specialMention || 0}</span>
                </div>
                <div class="award-item">
                    <span class="award-label">Verbal Mention:</span>
                    <span class="award-value">${reg.verbalMention || 0}</span>
                </div>
                <div class="award-item">
                    <span class="award-label">Total Points:</span>
                    <span class="award-value points">${totalPoints}</span>
                </div>
            </div>
        </div>
    `;
    
    // Allocation details if exists
    if (reg.allocation?.portfolio) {
        html += `
            <div class="section">
                <h4>✅ Allocation Details:</h4>
                <div class="allocation-grid">
                    <div class="allocation-item">
                        <span class="label">Committee:</span>
                        <span class="value">${reg.allocation.committee}</span>
                    </div>
                    <div class="allocation-item">
                        <span class="label">Portfolio:</span>
                        <span class="value">${reg.allocation.portfolio}</span>
                    </div>
                    ${reg.allocation.subCommittee ? `
                    <div class="allocation-item">
                        <span class="label">Sub-Committee:</span>
                        <span class="value">${reg.allocation.subCommittee}</span>
                    </div>` : ''}
                    <div class="allocation-item">
                        <span class="label">Status:</span>
                        <span class="value">${reg.allocation.status}</span>
                    </div>
                    <div class="allocation-item">
                        <span class="label">Allotted At:</span>
                        <span class="value">${reg.allocation.allottedAt ? new Date(reg.allocation.allottedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                </div>
                ${reg.allocation.status === 'Allotted' ? 
                    `<button class="action-btn danger" onclick="cancelAllotment('${reg.id}')">Cancel Allotment</button>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Toggle expand/collapse
function toggleExpand(id) {
    const details = document.getElementById(`details-${id}`);
    const icon = document.getElementById(`expand-icon-${id}`);
    
    if (details) {
        details.classList.toggle('show');
        icon.textContent = details.classList.contains('show') ? '▼' : '▶';
    }
}

// View preferences
function viewPreferences(userId) {
    toggleExpand(userId);
}

// Allot portfolio
async function allotPortfolio(userId, committee, portfolio, preferenceNumber) {
    if (!confirm(`Allot ${committee} - ${portfolio} to this user?`)) {
        return;
    }
    
    const registrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
    const userIndex = registrations.findIndex(r => r.id === userId);
    
    if (userIndex === -1) {
        alert('User not found!');
        return;
    }
    
    const user = registrations[userIndex];
    
    // Determine sub-committee for MOM/AIPPM
    let subCommittee = null;
    if (committee === 'MOM') {
        subCommittee = getMOMSubCommittee(portfolio);
    } else if (committee === 'AIPPM') {
        subCommittee = getAIPPMParty(portfolio);
    }
    
    // Update allocation locally first
    registrations[userIndex].allocation = {
        committee: committee,
        portfolio: portfolio,
        subCommittee: subCommittee,
        status: 'Allotted',
        allottedAt: new Date().toISOString(),
        preferenceNumber: preferenceNumber
    };
    
    localStorage.setItem('munRegistrations', JSON.stringify(registrations));
    
    try {
        // Try to sync with backend
        const response = await fetch(`${API_URL}/allot-portfolio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                committee: committee,
                portfolio: portfolio,
                subCommittee: subCommittee,
                userEmail: user.email,
                userName: user.name
            })
        });
        
        if (response.ok) {
            alert(`✅ Portfolio allotted successfully!\n📧 Email sent to ${user.email}`);
        } else {
            alert(`✅ Portfolio allotted locally!\n⚠️ Email could not be sent (backend offline)`);
        }
    } catch (error) {
        console.error('Backend sync failed:', error);
        alert(`✅ Portfolio allotted locally!\n⚠️ Backend sync failed`);
    }
    
    loadRegistrations();
}

// Cancel allotment
function cancelAllotment(userId) {
    if (!confirm('Are you sure you want to cancel this allotment?')) {
        return;
    }
    
    const registrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
    const userIndex = registrations.findIndex(r => r.id === userId);
    
    if (userIndex !== -1) {
        delete registrations[userIndex].allocation;
        localStorage.setItem('munRegistrations', JSON.stringify(registrations));
        loadRegistrations();
        alert('Allotment cancelled successfully!');
    }
}

// Send reminder email
async function sendReminderEmail(userId) {
    const registrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
    const user = registrations.find(r => r.id === userId);
    
    if (!user || !user.allocation) {
        alert('No allocation found for this user!');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/send-reminder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                userEmail: user.email,
                userName: user.name,
                committee: user.allocation.committee,
                portfolio: user.allocation.portfolio
            })
        });
        
        if (response.ok) {
            alert(`✅ Reminder email sent to ${user.email}!`);
        } else {
            alert(`❌ Failed to send reminder email`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`❌ Could not connect to email server`);
    }
}

// Resend confirmation
async function resendConfirmation(userId) {
    const registrations = JSON.parse(localStorage.getItem('munRegistrations') || '[]');
    const user = registrations.find(r => r.id === userId);
    
    if (!user || !user.allocation) {
        alert('No allocation found for this user!');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: user.email,
                userName: user.name,
                committee: user.allocation.committee,
                portfolio: user.allocation.portfolio,
                registrationId: user.id
            })
        });
        
        if (response.ok) {
            alert(`✅ Confirmation receipt sent to ${user.email}!`);
        } else {
            alert(`❌ Failed to send receipt`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`❌ Could not connect to email server`);
    }
}

// Helper functions for sub-committees
function getMOMSubCommittee(portfolio) {
    const mappings = {
        'Harry Potter': 'Auror Office',
        'Kingsley Shacklebolt': 'Auror Office',
        'Nymphadora Tonks': 'Auror Office',
        'Ron Weasley': 'Auror Office',
        'Albus Dumbledore': 'Wizengamot',
        'Percy Weasley': 'Wizengamot',
        'Cornelius Fudge': 'Wizengamot',
        'Saul Croaker': 'Department of Mysteries',
        'Arthur Weasley': 'Magical Law Enforcement',
        'Ludovic Bagman': 'Magical Games and Sports'
    };
    
    for (const [key, value] of Object.entries(mappings)) {
        if (portfolio.includes(key)) {
            return value;
        }
    }
    return 'Ministry of Magic';
}

function getAIPPMParty(portfolio) {
    const mappings = {
        'Narendra Modi': 'BJP',
        'Amit Shah': 'BJP',
        'Rahul Gandhi': 'INC',
        'Mallikarjun Kharge': 'INC',
        'Arvind Kejriwal': 'AAP',
        'Mamata Banerjee': 'TMC',
        'M.K. Stalin': 'DMK',
        'Akhilesh Yadav': 'SP',
        'Mayawati': 'BSP',
        'Sharad Pawar': 'NCP'
    };
    
    for (const [key, value] of Object.entries(mappings)) {
        if (portfolio.includes(key)) {
            return value;
        }
    }
    return 'Independent';
}

// Update statistics
function updateStats(registrations) {
    document.getElementById('totalRegistrations').textContent = registrations.length;
    document.getElementById('pendingAllotments').textContent = 
        registrations.filter(r => !r.allocation?.status || r.allocation.status === 'Pending').length;
    document.getElementById('allottedCount').textContent = 
        registrations.filter(r => r.allocation?.status === 'Allotted').length;
    document.getElementById('confirmedCount').textContent = 
        registrations.filter(r => r.allocation?.status === 'Confirmed').length;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadRegistrations();
    
    // Auto-refresh every 30 seconds
    setInterval(loadRegistrations, 30000);
});