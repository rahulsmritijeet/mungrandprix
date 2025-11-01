
const { useState, useEffect, useMemo } = React;

// API URL
const API_URL = 'http://localhost:3000/api';

window.addEventListener('DOMContentLoaded', () => {
    const starsContainer = document.getElementById('starsContainer');
    if (starsContainer) {
        for (let i = 0; i < 100; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.width = Math.random() * 3 + 'px';
            star.style.height = star.style.width;
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
            star.style.setProperty('--delay', Math.random() * 3 + 's');
            starsContainer.appendChild(star);
        }

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (20 + Math.random() * 10) + 's';
            starsContainer.appendChild(particle);
        }
    }
});

function RegistrationForm() {
    const initialFormData = {
        fullName: '',
        email: '',
        phone: '',
        dob: '',
        class: '',
        school: '',
        committee1: '',
        committee2: '',
        committee3: '',
        experience: '',
        bestDelegate: '',
        specialMention: '',
        verbalMention: '',
        participation: '',
        experienceDetails: ''
    };

    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [committeeSelections, setCommitteeSelections] = useState({
        1: { committee: '', portfolios: {}, specialData: {} },
        2: { committee: '', portfolios: {}, specialData: {} },
        3: { committee: '', portfolios: {}, specialData: {} }
    });

    // Dynamic portfolio states
    const [committees, setCommittees] = useState({});
    const [momDepartments, setMomDepartments] = useState([]);
    const [momPositions, setMomPositions] = useState({});
    const [aippmParties, setAippmParties] = useState([]);
    const [aippmPositions, setAippmPositions] = useState({});
    const [allottedPortfolios, setAllottedPortfolios] = useState(new Set());
    const [portfoliosLoading, setPortfoliosLoading] = useState(true);

    // Fetch portfolios from backend
    useEffect(() => {
        fetchPortfoliosFromBackend();
        // Refresh portfolio availability every 30 seconds
        const interval = setInterval(fetchPortfolioAvailability, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchPortfoliosFromBackend = async () => {
        try {
            const response = await fetch(`${API_URL}/portfolios`);
            const portfoliosData = await response.json();

            // Initialize committee structures
            const newCommittees = {
                UNGA: [],
                UNSC: [],
                UNHRC: [],
                UNCSW: [],
                WHO: []
            };

            // Process regular committees
            Object.keys(portfoliosData).forEach(committee => {
                if (committee !== 'MOM' && committee !== 'AIPPM') {
                    newCommittees[committee] = portfoliosData[committee].map(p => p.name);
                }
            });

            setCommittees(newCommittees);

            // Process MOM departments
            if (portfoliosData.MOM) {
                const depts = Object.keys(portfoliosData.MOM);
                setMomDepartments(depts);

                const positions = {};
                depts.forEach(dept => {
                    positions[dept] = portfoliosData.MOM[dept].map(p => p.name);
                });
                setMomPositions(positions);
            }

            // Process AIPPM parties
            if (portfoliosData.AIPPM) {
                const parties = Object.keys(portfoliosData.AIPPM).map(party => ({
                    code: party,
                    name: getPartyFullName(party)
                }));
                setAippmParties(parties);

                const positions = {};
                Object.keys(portfoliosData.AIPPM).forEach(party => {
                    positions[party] = portfoliosData.AIPPM[party].map(p => p.name);
                });
                setAippmPositions(positions);
            }

            setPortfoliosLoading(false);

            // Fetch availability after loading portfolios
            await fetchPortfolioAvailability();

        } catch (error) {
            console.error('Error fetching portfolios from backend:', error);
            setPortfoliosLoading(false);
        }
    };

    const fetchPortfolioAvailability = async () => {
        try {
            const registrationsResponse = await fetch(`${API_URL}/registrations`);
            const registrations = await registrationsResponse.json();

            const allotted = new Set();

            // Process registrations for allocated portfolios
            registrations.forEach(reg => {
                if (reg.allocation && reg.allocation.portfolio && reg.allocation.status !== 'Pending') {
                    const { committee, portfolio, subCommittee } = reg.allocation;

                    if (subCommittee) {
                        allotted.add(`${committee}-${subCommittee}-${portfolio}`);
                    } else {
                        allotted.add(`${committee}-${portfolio}`);
                    }
                }
            });

            setAllottedPortfolios(allotted);

        } catch (error) {
            console.error('Error fetching portfolio availability:', error);
        }
    };

    const getPartyFullName = (code) => {
        const partyNames = {
            'BJP': 'Bharatiya Janata Party',
            'INC': 'Indian National Congress',
            'AAP': 'Aam Aadmi Party',
            'TMC': 'All India Trinamool Congress',
            'DMK': 'Dravida Munnetra Kazhagam',
            'SP': 'Samajwadi Party',
            'NCP': 'Nationalist Congress Party',
            'BSP': 'Bahujan Samaj Party',
            'TDP': 'Telugu Desam Party',
            'CPI(M)': 'Communist Party of India (Marxist)'
        };
        return partyNames[code] || code;
    };

    const isPortfolioAvailable = (committee, portfolio, subCommittee = null) => {
        if (subCommittee) {
            return !allottedPortfolios.has(`${committee}-${subCommittee}-${portfolio}`);
        } else {
            return !allottedPortfolios.has(`${committee}-${portfolio}`);
        }
    };

    const calculateTotalConferences = () => {
        return (parseInt(formData.bestDelegate || 0) +
            parseInt(formData.specialMention || 0) +
            parseInt(formData.verbalMention || 0) +
            parseInt(formData.participation || 0));
    };

    const calculateTotalAwards = () => {
        return (parseInt(formData.bestDelegate || 0) +
            parseInt(formData.specialMention || 0) +
            parseInt(formData.verbalMention || 0));
    };

    const calculateSuccessRate = () => {
        const total = calculateTotalConferences();
        const awards = calculateTotalAwards();
        return total > 0 ? Math.round((awards / total) * 100) : 0;
    };

    const selectedCommittees = useMemo(() => {
        return Object.values(committeeSelections)
            .map(sel => sel.committee)
            .filter(Boolean);
    }, [committeeSelections]);

    const getSelectedPortfoliosForCommittee = (num) => {
        const selection = committeeSelections[num];
        if (!selection.portfolios) return [];
        return Object.values(selection.portfolios).filter(Boolean);
    };

    const getSelectedMoMDepartmentsForCommittee = (num) => {
        const selection = committeeSelections[num];
        if (!selection.specialData) return [];
        return ['dept1', 'dept2', 'dept3']
            .map(key => selection.specialData[key])
            .filter(Boolean);
    };

    const getSelectedMoMPositionsForCommittee = (num, deptIndex) => {
        const selection = committeeSelections[num];
        if (!selection.specialData) return [];
        const positions = [];

        for (let j = 1; j <= 2; j++) {
            const key = `dept${deptIndex}_pos${j}`;
            if (selection.specialData[key]) {
                positions.push(selection.specialData[key]);
            }
        }

        return positions;
    };

    const getSelectedAIPPMPartiesForCommittee = (num) => {
        const selection = committeeSelections[num];
        if (!selection.specialData) return [];
        return ['party1', 'party2', 'party3']
            .map(key => selection.specialData[key])
            .filter(Boolean);
    };

    const getSelectedAIPPMPositionsForCommittee = (num, partyIndex) => {
        const selection = committeeSelections[num];
        if (!selection.specialData) return [];
        const positions = [];

        for (let j = 1; j <= 2; j++) {
            const key = `party${partyIndex}_pos${j}`;
            if (selection.specialData[key]) {
                positions.push(selection.specialData[key]);
            }
        }

        return positions;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCommitteeChange = (num, value) => {
        setFormData(prev => ({ ...prev, [`committee${num}`]: value }));
        setCommitteeSelections(prev => ({
            ...prev,
            [num]: {
                committee: value,
                portfolios: {},
                specialData: {}
            }
        }));
    };

    const handlePortfolioChange = (committeeNum, portfolioNum, value) => {
        setCommitteeSelections(prev => ({
            ...prev,
            [committeeNum]: {
                ...prev[committeeNum],
                portfolios: {
                    ...prev[committeeNum].portfolios,
                    [portfolioNum]: value
                }
            }
        }));
    };

    const handleSpecialDataChange = (committeeNum, key, value) => {
        setCommitteeSelections(prev => ({
            ...prev,
            [committeeNum]: {
                ...prev[committeeNum],
                specialData: {
                    ...prev[committeeNum].specialData,
                    [key]: value
                }
            }
        }));
    };

    const resetForm = () => {
        setFormData(initialFormData);
        setCommitteeSelections({
            1: { committee: '', portfolios: {}, specialData: {} },
            2: { committee: '', portfolios: {}, specialData: {} },
            3: { committee: '', portfolios: {}, specialData: {} }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Prepare preferences in the format expected by the server
            const preferences = {};

            // Process each committee preference
            for (let i = 1; i <= 3; i++) {
                const selection = committeeSelections[i];

                if (selection && selection.committee) {
                    preferences[`preference${i}`] = {
                        committee: selection.committee,
                        portfolio: null,
                        subCommittee: null
                    };

                    // For regular committees
                    if (selection.committee !== 'MOM' && selection.committee !== 'AIPPM') {
                        // Get first selected portfolio
                        const firstPortfolio = selection.portfolios && selection.portfolios[1];
                        if (firstPortfolio) {
                            preferences[`preference${i}`].portfolio = firstPortfolio;
                        }
                    }

                    // For MOM
                    else if (selection.committee === 'MOM' && selection.specialData) {
                        // Get first department with a position
                        for (let d = 1; d <= 3; d++) {
                            const dept = selection.specialData[`dept${d}`];
                            const pos = selection.specialData[`dept${d}_pos1`];

                            if (dept && pos) {
                                preferences[`preference${i}`].subCommittee = dept;
                                preferences[`preference${i}`].portfolio = pos;
                                break;
                            }
                        }
                    }

                    // For AIPPM
                    else if (selection.committee === 'AIPPM' && selection.specialData) {
                        // Get first party with a position
                        for (let p = 1; p <= 3; p++) {
                            const party = selection.specialData[`party${p}`];
                            const pos = selection.specialData[`party${p}_pos1`];

                            if (party && pos) {
                                preferences[`preference${i}`].subCommittee = party;
                                preferences[`preference${i}`].portfolio = pos;
                                break;
                            }
                        }
                    }
                }
            }

            // Prepare complete submission data
            const submissionData = {
                // Personal Information
                name: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                dob: formData.dob,
                class: formData.class,
                institution: formData.school,

                // Experience
                experience: formData.experience || '0',
                bestDelegate: parseInt(formData.bestDelegate) || 0,
                specialMention: parseInt(formData.specialMention) || 0,
                verbalMention: parseInt(formData.verbalMention) || 0,
                participation: parseInt(formData.participation) || 0,
                experienceDetails: formData.experienceDetails || '',

                // Preferences
                preferences: preferences,

                // Full committee selections for detailed view in admin panel
                fullSelections: committeeSelections
            };

            // Send to backend
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submissionData)
            });

            const result = await response.json();

            if (result.success) {
                setShowSuccess(true);

                // Show success message with registration number
                alert(`✅ Registration successful!\n\nYour Registration ID: MUN2024-${result.id}\n\nYou will receive a confirmation email shortly.`);

                resetForm();
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Refresh portfolio availability
                fetchPortfolioAvailability();

                setTimeout(() => {
                    setShowSuccess(false);
                }, 5000);
            } else {
                alert('❌ Registration failed: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error submitting registration:', error);
            alert('❌ Network error. Please ensure the server is running at http://localhost:3000');
        } finally {
            setLoading(false);
        }
    };

    const renderCommitteeBlock = (num) => {
        const committee = committeeSelections[num].committee;
        const isSpecialCommittee = committee === 'MOM' || committee === 'AIPPM';

        const selectedPortfolios = getSelectedPortfoliosForCommittee(num);
        const selectedMoMDepartments = getSelectedMoMDepartmentsForCommittee(num);
        const selectedAIPPMParties = getSelectedAIPPMPartiesForCommittee(num);

        return (
            <div className="committee-block" key={num}>
                <div className="committee-header">
                    <div className="committee-number">{num}</div>
                    <div className="committee-title">
                        {num === 1 ? 'First' : num === 2 ? 'Second' : 'Third'} Committee Preference
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor={`committee${num}`}>
                        Select Committee {num === 1 ? '*' : ''}
                    </label>
                    <select
                        className="form-control"
                        id={`committee${num}`}
                        value={committeeSelections[num].committee}
                        onChange={(e) => handleCommitteeChange(num, e.target.value)}
                        required={num === 1}
                    >
                        <option value="">
                            Choose your {num === 1 ? 'first' : num === 2 ? 'second' : 'third'} committee
                            {num !== 1 ? ' (optional)' : ''}
                        </option>
                        {['AIPPM', 'MOM', 'UNCSW', 'UNGA', 'UNHRC', 'UNSC', 'WHO'].map(comm => {
                            const isDisabled = selectedCommittees.includes(comm) && committeeSelections[num].committee !== comm;
                            return (
                                <option key={comm} value={comm} disabled={isDisabled}>
                                    {comm === 'UNGA' && 'UNGA - United Nations General Assembly'}
                                    {comm === 'UNSC' && 'UNSC - United Nations Security Council'}
                                    {comm === 'UNHRC' && 'UNHRC - UN Human Rights Council'}
                                    {comm === 'UNCSW' && 'UNCSW - UN Commission on Status of Women'}
                                    {comm === 'WHO' && 'WHO - World Health Organization'}
                                    {comm === 'MOM' && 'MoM - Ministry of Magic'}
                                    {comm === 'AIPPM' && 'AIPPM - All India Political Party Meet'}
                                    {isDisabled && ' (already chosen)'}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {!isSpecialCommittee && committee && (
                    <div className="portfolio-grid">
                        {portfoliosLoading ? (
                            <div style={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', padding: '20px' }}>
                                Loading portfolios...
                            </div>
                        ) : (
                            [1, 2, 3].map(i => (
                                <div className="portfolio-item" key={i}>
                                    <div className="portfolio-label">
                                        Portfolio Choice {num}.{i} {i <= 2 && num === 1 ? '*' : ''}
                                    </div>
                                    <select
                                        className="form-control"
                                        value={committeeSelections[num].portfolios[i] || ''}
                                        onChange={(e) => handlePortfolioChange(num, i, e.target.value)}
                                        required={num === 1 && i <= 2}
                                    >
                                        <option value="">Select portfolio</option>
                                        {committees[committee]?.map(portfolio => {
                                            const isDisabled = selectedPortfolios.includes(portfolio) &&
                                                committeeSelections[num].portfolios[i] !== portfolio;
                                            const isAllotted = !isPortfolioAvailable(committee, portfolio);
                                            return (
                                                <option
                                                    key={portfolio}
                                                    value={portfolio}
                                                    disabled={isDisabled || isAllotted}
                                                    style={{ color: isAllotted ? '#ff6666' : '' }}
                                                >
                                                    {portfolio}
                                                    {isDisabled && ' (already chosen)'}
                                                    {isAllotted && ' (Allotted)'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {committee === 'MOM' && (
                    <div className="special-committee-section active">
                        <div className="special-header">Ministry of Magic - Department Preferences</div>
                        <div className="special-grid">
                            {[1, 2, 3].map(i => (
                                <div className="special-item" key={i} style={{ '--delay': `${i * 0.1}s` }}>
                                    <div className="special-item-header">Department Preference {i}</div>
                                    <div className="form-group">
                                        <label>Select Department</label>
                                        <select
                                            className="form-control"
                                            value={committeeSelections[num].specialData[`dept${i}`] || ''}
                                            onChange={(e) => handleSpecialDataChange(num, `dept${i}`, e.target.value)}
                                        >
                                            <option value="">Choose department</option>
                                            {momDepartments.map(dept => {
                                                const isDisabled = selectedMoMDepartments.includes(dept) &&
                                                    committeeSelections[num].specialData[`dept${i}`] !== dept;
                                                return (
                                                    <option key={dept} value={dept} disabled={isDisabled}>
                                                        {dept}{isDisabled && ' (already chosen)'}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    {committeeSelections[num].specialData[`dept${i}`] && (
                                        <div className="portfolio-grid" style={{ marginTop: '1rem' }}>
                                            {[1, 2].map(j => {
                                                const selectedPositions = getSelectedMoMPositionsForCommittee(num, i);
                                                const dept = committeeSelections[num].specialData[`dept${i}`];
                                                return (
                                                    <div className="portfolio-item" key={j}>
                                                        <div className="portfolio-label">Position {i}.{j}</div>
                                                        <select
                                                            className="form-control"
                                                            value={committeeSelections[num].specialData[`dept${i}_pos${j}`] || ''}
                                                            onChange={(e) => handleSpecialDataChange(num, `dept${i}_pos${j}`, e.target.value)}
                                                        >
                                                            <option value="">Select position</option>
                                                            {momPositions[dept]?.map(pos => {
                                                                const isDisabled = selectedPositions.includes(pos) &&
                                                                    committeeSelections[num].specialData[`dept${i}_pos${j}`] !== pos;
                                                                const isAllotted = !isPortfolioAvailable('MOM', pos, dept);
                                                                return (
                                                                    <option
                                                                        key={pos}
                                                                        value={pos}
                                                                        disabled={isDisabled || isAllotted}
                                                                        style={{ color: isAllotted ? '#ff6666' : '' }}
                                                                    >
                                                                        {pos}
                                                                        {isDisabled && ' (already chosen)'}
                                                                        {isAllotted && ' (Allotted)'}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {committee === 'AIPPM' && (
                    <div className="special-committee-section active">
                        <div className="special-header">AIPPM - Political Party Preferences</div>
                        <div className="special-grid">
                            {[1, 2, 3].map(i => (
                                <div className="special-item" key={i} style={{ '--delay': `${i * 0.1}s` }}>
                                    <div className="special-item-header">Political Party Preference {i}</div>
                                    <div className="form-group">
                                        <label>Select Party</label>
                                        <select
                                            className="form-control"
                                            value={committeeSelections[num].specialData[`party${i}`] || ''}
                                            onChange={(e) => handleSpecialDataChange(num, `party${i}`, e.target.value)}
                                        >
                                            <option value="">Choose party</option>
                                            {aippmParties.map(party => {
                                                const isDisabled = selectedAIPPMParties.includes(party.code) &&
                                                    committeeSelections[num].specialData[`party${i}`] !== party.code;
                                                return (
                                                    <option key={party.code} value={party.code} disabled={isDisabled}>
                                                        {party.code} - {party.name}
                                                        {isDisabled && ' (already chosen)'}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    {committeeSelections[num].specialData[`party${i}`] && (
                                        <div className="portfolio-grid" style={{ marginTop: '1rem' }}>
                                            {[1, 2].map(j => {
                                                const selectedPositions = getSelectedAIPPMPositionsForCommittee(num, i);
                                                const party = committeeSelections[num].specialData[`party${i}`];
                                                return (
                                                    <div className="portfolio-item" key={j}>
                                                        <div className="portfolio-label">Position {i}.{j}</div>
                                                        <select
                                                            className="form-control"
                                                            value={committeeSelections[num].specialData[`party${i}_pos${j}`] || ''}
                                                            onChange={(e) => handleSpecialDataChange(num, `party${i}_pos${j}`, e.target.value)}
                                                        >
                                                            <option value="">Select position</option>
                                                            {aippmPositions[party]?.map(pos => {
                                                                const isDisabled = selectedPositions.includes(pos) &&
                                                                    committeeSelections[num].specialData[`party${i}_pos${j}`] !== pos;
                                                                const isAllotted = !isPortfolioAvailable('AIPPM', pos, party);
                                                                return (
                                                                    <option
                                                                        key={pos}
                                                                        value={pos}
                                                                        disabled={isDisabled || isAllotted}
                                                                        style={{ color: isAllotted ? '#ff6666' : '' }}
                                                                    >
                                                                        {pos}
                                                                        {isDisabled && ' (already chosen)'}
                                                                        {isAllotted && ' (Allotted)'}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (portfoliosLoading && Object.keys(committees).length === 0) {
        return (
            <div className="app-container">
                <div className="registration-container" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '2rem' }}>
                        Loading registration form...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <div className="registration-container">
                <div className="form-header">
                    <h1>MUN Grand Prix</h1>
                    <p>Join the Global Dialogue</p>
                </div>

                {showSuccess && (
                    <div className="success-message">
                        <h3>✨ Registration Submitted Successfully!</h3>
                        <p>We'll send you a confirmation email within 24 hours.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name *</label>
                            <input
                                type="text"
                                className="form-control"
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address *</label>
                            <input
                                type="email"
                                className="form-control"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="your.email@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="phone">Phone Number (India) *</label>
                            <input
                                type="tel"
                                className="form-control"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                placeholder="+91 98765 43210"
                                pattern="^(\+91)?[6-9]\d{9}$"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="dob">Date of Birth *</label>
                            <input
                                type="date"
                                className="form-control"
                                id="dob"
                                name="dob"
                                value={formData.dob}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="class">Class/Grade *</label>
                            <select
                                className="form-control"
                                id="class"
                                name="class"
                                value={formData.class}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select your class</option>
                                <option value="8">Class 8</option>
                                <option value="9">Class 9</option>
                                <option value="10">Class 10</option>
                                <option value="11">Class 11</option>
                                <option value="12">Class 12</option>
                                <option value="undergraduate">Undergraduate</option>
                                <option value="postgraduate">Postgraduate</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="school">School/Institution *</label>
                            <input
                                type="text"
                                className="form-control"
                                id="school"
                                name="school"
                                value={formData.school}
                                onChange={handleInputChange}
                                placeholder="Enter your school name"
                                required
                            />
                        </div>
                    </div>

                    <h3 className="section-title">Committee & Portfolio Preferences</h3>

                    {[1, 2, 3].map(num => renderCommitteeBlock(num))}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="experience">Previous MUN Experiences *</label>
                            <select
                                className="form-control"
                                id="experience"
                                name="experience"
                                value={formData.experience}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select number of conferences</option>
                                <option value="0">No prior experience</option>
                                <option value="1">1 conference</option>
                                <option value="2">2 conferences</option>
                                <option value="3">3 conferences</option>
                                <option value="4">4 conferences</option>
                                <option value="5">5 conferences</option>
                                <option value="6-10">6-10 conferences</option>
                                <option value="11-20">11-20 conferences</option>
                                <option value="21-30">21-30 conferences</option>
                                <option value="30+">More than 30 conferences</option>
                            </select>
                        </div>
                    </div>

                    {formData.experience && formData.experience !== '0' && (
                        <div className="experience-details-section">
                            <h3 className="section-title">Award Details</h3>
                            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Please specify the number of awards you've received in your MUN journey
                            </p>

                            <div className="awards-grid">
                                <div className="award-item">
                                    <div className="award-icon best-delegate">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                    </div>
                                    <div className="award-content">
                                        <label htmlFor="bestDelegate">Best Delegate Awards</label>
                                        <input
                                            type="number"
                                            className="form-control award-input"
                                            id="bestDelegate"
                                            name="bestDelegate"
                                            value={formData.bestDelegate || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                            min="0"
                                            max="50"
                                        />
                                    </div>
                                </div>

                                <div className="award-item">
                                    <div className="award-icon special-mention">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="8" r="7" />
                                            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                                        </svg>
                                    </div>
                                    <div className="award-content">
                                        <label htmlFor="specialMention">Special Mention Awards</label>
                                        <input
                                            type="number"
                                            className="form-control award-input"
                                            id="specialMention"
                                            name="specialMention"
                                            value={formData.specialMention || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                            min="0"
                                            max="50"
                                        />
                                    </div>
                                </div>

                                <div className="award-item">
                                    <div className="award-icon verbal-mention">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <div className="award-content">
                                        <label htmlFor="verbalMention">Verbal Mention Awards</label>
                                        <input
                                            type="number"
                                            className="form-control award-input"
                                            id="verbalMention"
                                            name="verbalMention"
                                            value={formData.verbalMention || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                            min="0"
                                            max="50"
                                        />
                                    </div>
                                </div>

                                <div className="award-item">
                                    <div className="award-icon participation">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                    </div>
                                    <div className="award-content">
                                        <label htmlFor="participation">Participations (No Award)</label>
                                        <input
                                            type="number"
                                            className="form-control award-input"
                                            id="participation"
                                            name="participation"
                                            value={formData.participation || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                            min="0"
                                            max="50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {(formData.bestDelegate || formData.specialMention || formData.verbalMention || formData.participation) && (
                                <div className="experience-summary">
                                    <div className="summary-header">Your MUN Journey Summary</div>
                                    <div className="summary-content">
                                        <div className="summary-stat">
                                            <span className="stat-value">{calculateTotalConferences()}</span>
                                            <span className="stat-label">Total Conferences</span>
                                        </div>
                                        <div className="summary-stat">
                                            <span className="stat-value">{calculateTotalAwards()}</span>
                                            <span className="stat-label">Total Awards</span>
                                        </div>
                                        <div className="summary-stat">
                                            <span className="stat-value">{calculateSuccessRate()}%</span>
                                            <span className="stat-label">Success Rate</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label htmlFor="experienceDetails">Additional Details (Optional)</label>
                                <textarea
                                    className="form-control"
                                    id="experienceDetails"
                                    name="experienceDetails"
                                    value={formData.experienceDetails}
                                    onChange={handleInputChange}
                                    placeholder="Any specific achievements, leadership roles, or memorable experiences you'd like to share..."
                                    rows="4"
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Registration'}
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                </div>
            )}
        </div>
    );
}

ReactDOM.render(<RegistrationForm />, document.getElementById('root'));
