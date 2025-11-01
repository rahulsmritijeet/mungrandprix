// server.js - Fixed to show ONLY ONE allocated portfolio in the email

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import portfolio hierarchy system
const {
    portfolioTiers,
    bonusPoints,
    calculateUserPoints,
    getPortfolioTierAndEligibility,
    calculateAllocationScore
} = require('./portfolioSystem');

const app = express();
app.use(cors());
app.use(express.json());

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify email configuration
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email server error:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

// Helper functions to read/write JSON files
function readPortfolios() {
    const filePath = path.join(__dirname, 'data/portfolios.json');
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error('Error reading portfolios:', error);
        return {};
    }
}

function writePortfolios(data) {
    const filePath = path.join(__dirname, 'data/portfolios.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readRegistrations() {
    const filePath = path.join(__dirname, 'data/registrations.json');
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeRegistrations(data) {
    const filePath = path.join(__dirname, 'data/registrations.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// API: Get all portfolios
app.get('/api/portfolios', (req, res) => {
    const portfolios = readPortfolios();
    res.json(portfolios);
});

// API: Get all registrations with eligibility info
app.get('/api/registrations', (req, res) => {
    const registrations = readRegistrations();
    
    // Add eligibility information for each registration
    const enrichedRegistrations = registrations.map(reg => {
        const eligibilityInfo = {};
        
        // Check eligibility for each preference
        for (let i = 1; i <= 3; i++) {
            const pref = reg.preferences?.[`preference${i}`];
            if (pref && pref.committee && pref.portfolio) {
                eligibilityInfo[`preference${i}`] = getPortfolioTierAndEligibility(
                    pref.portfolio, 
                    pref.committee, 
                    reg
                );
            }
        }
        
        return {
            ...reg,
            totalPoints: calculateUserPoints(reg),
            eligibilityInfo
        };
    });
    
    res.json(enrichedRegistrations);
});

// API: Check portfolio eligibility
app.post('/api/check-eligibility', (req, res) => {
    const { userId, committee, portfolio } = req.body;
    
    const registrations = readRegistrations();
    const user = registrations.find(r => r.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const eligibility = getPortfolioTierAndEligibility(portfolio, committee, user);
    const score = calculateAllocationScore(portfolio, committee, user, 1);
    
    res.json({
        eligible: eligibility.isEligible,
        tier: eligibility.tier,
        tierPoints: eligibility.points,
        userPoints: eligibility.userPoints,
        score: score.score,
        reason: score.reason || null,
        requirements: {
            minExperience: eligibility.requiredExperience,
            minBestDelegates: eligibility.requiredBestDelegates,
            userExperience: eligibility.userExperience,
            userBestDelegates: eligibility.userBestDelegates
        }
    });
});

// API: Save new registration
app.post('/api/register', async (req, res) => {
    const registrations = readRegistrations();
    const newRegistration = {
        ...req.body,
        id: Date.now().toString(),
        registeredAt: new Date().toISOString(),
        allocation: {
            status: 'Pending',
            committee: null,
            portfolio: null,
            subCommittee: null,
            allottedAt: null,
            confirmedAt: null
        }
    };
    
    registrations.push(newRegistration);
    writeRegistrations(registrations);
    
    // Send registration confirmation email
    await sendRegistrationConfirmationEmail(newRegistration);
    
    res.json({ 
        success: true, 
        id: newRegistration.id,
        message: 'Registration successful' 
    });
});

// API: Allot portfolio - User gets ONLY ONE portfolio
app.post('/api/allot-portfolio', async (req, res) => {
    const { userId, committee, portfolio, subCommittee, preferenceNumber } = req.body;
    
    const portfolios = readPortfolios();
    const registrations = readRegistrations();
    
    // Find the user
    const userIndex = registrations.findIndex(r => r.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = registrations[userIndex];
    
    // Check if already allotted (prevent duplicate allocations)
    if (user.allocation && user.allocation.portfolio && user.allocation.status !== 'Pending') {
        return res.status(400).json({ 
            error: 'User already has a portfolio allotted',
            currentAllocation: {
                committee: user.allocation.committee,
                portfolio: user.allocation.portfolio
            }
        });
    }
    
    // Check eligibility using portfolio hierarchy
    const eligibility = getPortfolioTierAndEligibility(portfolio, committee, user);
    
    if (!eligibility.isEligible) {
        return res.status(400).json({
            error: 'User not eligible for this portfolio',
            reason: `Requires ${eligibility.requiredExperience}+ MUNs and ${eligibility.requiredBestDelegates}+ Best Delegates`,
            currentStats: {
                experience: eligibility.userExperience,
                bestDelegates: eligibility.userBestDelegates
            }
        });
    }
    
    // Calculate allocation score
    const allocationScore = calculateAllocationScore(portfolio, committee, user, preferenceNumber || 1);
    
    // Update portfolio status in portfolios.json
    if (committee === 'MOM' || committee === 'AIPPM') {
        const dept = portfolios[committee]?.[subCommittee];
        if (dept) {
            const portfolioIndex = dept.findIndex(p => p.name === portfolio);
            if (portfolioIndex !== -1) {
                portfolios[committee][subCommittee][portfolioIndex].status = 'Allotted';
                portfolios[committee][subCommittee][portfolioIndex].delegate = user.name;
                portfolios[committee][subCommittee][portfolioIndex].allocationScore = allocationScore.score;
            }
        }
    } else {
        const portfolioIndex = portfolios[committee]?.findIndex(p => p.name === portfolio);
        if (portfolioIndex !== -1) {
            portfolios[committee][portfolioIndex].status = 'Allotted';
            portfolios[committee][portfolioIndex].delegate = user.name;
            portfolios[committee][portfolioIndex].allocationScore = allocationScore.score;
        }
    }
    
    // Update user registration with ONLY THIS ONE allocation
    registrations[userIndex].allocation = {
        status: 'Allotted',
        committee,
        portfolio,
        subCommittee,
        allottedAt: new Date().toISOString(),
        confirmedAt: null,
        tier: eligibility.tier,
        allocationScore: allocationScore.score,
        preferenceNumber: preferenceNumber
    };
    
    // Save changes
    writePortfolios(portfolios);
    writeRegistrations(registrations);
    
    // Generate confirmation URL
    const confirmationUrl = `http://localhost:${process.env.PORT || 3000}/api/confirm-payment/${userId}`;
    
    // Send allotment email with ONLY the allocated portfolio
    let emailSent = false;
    let emailError = null;
    
    try {
        const emailContent = {
            from: `MUN Conference 2025 <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '🎉 Portfolio Allotted - MUN Conference 2025',
            html: generateSingleAllotmentEmail(user, committee, portfolio, subCommittee, eligibility, confirmationUrl, preferenceNumber)
        };
        
        await transporter.sendMail(emailContent);
        emailSent = true;
        console.log(`✅ Allotment email sent to ${user.email} for ${committee} - ${portfolio}`);
    } catch (error) {
        emailError = error.message;
        console.error('❌ Email error:', error);
    }
    
    res.json({ 
        success: true, 
        message: emailSent ? 'Portfolio allotted and email sent successfully' : 'Portfolio allotted but email failed',
        emailSent: emailSent,
        emailError: emailError,
        allocation: {
            committee,
            portfolio,
            tier: eligibility.tier,
            score: allocationScore.score
        }
    });
});

// Generate email for SINGLE portfolio allocation
function generateSingleAllotmentEmail(user, committee, portfolio, subCommittee, eligibility, confirmationUrl, preferenceNumber) {
    const tierColors = {
        tier1: '#FFD700', // Gold
        tier2: '#C0C0C0', // Silver
        tier3: '#CD7F32', // Bronze
        tier4: '#667eea', // Purple
        tier5: '#4CAF50', // Green
        tier6: '#2196F3'  // Blue
    };
    
    const tierNames = {
        tier1: 'Most Prestigious',
        tier2: 'Highly Prestigious',
        tier3: 'Prestigious',
        tier4: 'Intermediate',
        tier5: 'Entry Level',
        tier6: 'Beginner'
    };
    
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Arial', sans-serif; 
            background: #f5f5f5; 
            line-height: 1.6;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .content { 
            padding: 40px 30px;
        }
        .tier-badge {
            display: inline-block;
            background: ${tierColors[eligibility.tier] || '#667eea'};
            color: ${eligibility.tier === 'tier1' ? '#333' : 'white'};
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            margin: 10px 0;
        }
        .portfolio-box { 
            background: #f8f9fa; 
            padding: 25px; 
            border-radius: 10px; 
            margin: 25px 0;
            border-left: 4px solid ${tierColors[eligibility.tier] || '#667eea'};
        }
        .portfolio-box h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 20px;
        }
        .portfolio-detail {
            margin: 12px 0;
            color: #555;
            font-size: 15px;
        }
        .portfolio-detail strong {
            color: #333;
            display: inline-block;
            width: 140px;
        }
        .success-message {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .action-section {
            background: #fff3cd;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
            border: 1px solid #ffeaa7;
        }
        .action-section h3 {
            color: #856404;
            margin-bottom: 15px;
        }
        .button-container {
            text-align: center;
            margin: 35px 0;
        }
        .confirm-button {
            display: inline-block;
            padding: 18px 50px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-size: 18px;
            font-weight: bold;
            box-shadow: 0 5px 20px rgba(40, 167, 69, 0.4);
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e0e0e0;
        }
        .info-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .info-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p style="font-size: 18px;">Portfolio Successfully Allotted</p>
        </div>
        
        <div class="content">
            <p style="font-size: 16px; color: #333;">Dear <strong>${user.name}</strong>,</p>
            
            <div class="success-message">
                <strong>Great news!</strong> Based on your experience and qualifications, you have been allotted your 
                ${preferenceNumber ? `preference #${preferenceNumber}` : 'selected'} portfolio.
            </div>
            
            <div class="portfolio-box">
                <h3>📋 YOUR ALLOTTED PORTFOLIO</h3>
                <div class="portfolio-detail">
                    <strong>Committee:</strong> ${committee}
                </div>
                <div class="portfolio-detail">
                    <strong>Portfolio:</strong> ${portfolio}
                </div>
                ${subCommittee ? `
                <div class="portfolio-detail">
                    <strong>Sub-Committee:</strong> ${subCommittee}
                </div>` : ''}
                <div class="portfolio-detail">
                    <strong>Portfolio Tier:</strong> 
                    <span class="tier-badge">Tier ${eligibility.tier.replace('tier', '')} - ${tierNames[eligibility.tier]}</span>
                </div>
                <div class="portfolio-detail">
                    <strong>Allotted on:</strong> ${new Date().toLocaleDateString('en-IN', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-value">${eligibility.userExperience}</div>
                    <div class="info-label">Your MUN Experience</div>
                </div>
                <div class="info-item">
                    <div class="info-value">${eligibility.userBestDelegates}</div>
                    <div class="info-label">Best Delegate Awards</div>
                </div>
                <div class="info-item">
                    <div class="info-value">${eligibility.userPoints}</div>
                    <div class="info-label">Total Points</div>
                </div>
                <div class="info-item">
                    <div class="info-value">₹500</div>
                    <div class="info-label">Registration Fee</div>
                </div>
            </div>
            
            <div class="action-section">
                <h3>⚠️ Action Required</h3>
                <p style="color: #666; margin: 10px 0;">
                    To confirm your participation and secure this portfolio, please complete the registration process by clicking the button below:
                </p>
            </div>
            
            <div class="button-container">
                <a href="${confirmationUrl}" class="confirm-button">
                    ✅ CONFIRM MY PARTICIPATION
                </a>
            </div>
            
            <div style="background: #e8f4f8; padding: 20px; border-radius: 10px; margin: 25px 0;">
                <h4 style="color: #333; margin-bottom: 10px;">📅 Conference Details</h4>
                <p style="color: #555; margin: 5px 0;">• <strong>Date:</strong> 15-17 March 2025</p>
                <p style="color: #555; margin: 5px 0;">• <strong>Venue:</strong> Convention Center, New Delhi</p>
                <p style="color: #555; margin: 5px 0;">• <strong>Reporting Time:</strong> 8:30 AM</p>
                <p style="color: #555; margin: 5px 0;">• <strong>Dress Code:</strong> Western Formals</p>
            </div>
            
            <p style="color: #999; font-size: 13px; margin-top: 20px; font-style: italic;">
                Note: This portfolio is exclusively reserved for you. Please confirm within 48 hours to secure your spot.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Need Help?</strong></p>
            <p>📧 <a href="mailto:munconference2025@gmail.com">munconference2025@gmail.com</a></p>
            <p>📱 +91 9876543210</p>
            <br>
            <p style="font-size: 12px; color: #999;">
                This is an automated email. Please do not reply directly to this message.
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

// Function to send registration confirmation email
async function sendRegistrationConfirmationEmail(user) {
    try {
        const emailContent = {
            from: `MUN Conference 2025 <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '✅ Registration Successful - MUN Conference 2025',
            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: #667eea; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f8f9fa; }
        .pref-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Registration Successful!</h1>
        </div>
        <div class="content">
            <p>Dear ${user.name},</p>
            <p>Thank you for registering for MUN Conference 2025!</p>
            <p>Your registration ID is: <strong>MUN2025-${user.id}</strong></p>
            
            <div class="pref-list">
                <h3>Your Preferences:</h3>
                <ol>
                    ${user.preferences?.preference1 ? `<li>${user.preferences.preference1.committee} - ${user.preferences.preference1.portfolio}</li>` : ''}
                    ${user.preferences?.preference2 ? `<li>${user.preferences.preference2.committee} - ${user.preferences.preference2.portfolio}</li>` : ''}
                    ${user.preferences?.preference3 ? `<li>${user.preferences.preference3.committee} - ${user.preferences.preference3.portfolio}</li>` : ''}
                </ol>
            </div>
            
            <p>We will review your preferences and allot you <strong>ONE suitable portfolio</strong> based on your experience and achievements.</p>
            <p>You will receive an email once your portfolio is allotted.</p>
        </div>
    </div>
</body>
</html>`
        };
        
        await transporter.sendMail(emailContent);
        console.log(`✅ Registration confirmation sent to ${user.email}`);
    } catch (error) {
        console.error('❌ Failed to send registration confirmation:', error);
    }
}

// API: Confirm payment (via email button click)
app.get('/api/confirm-payment/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const portfolios = readPortfolios();
    const registrations = readRegistrations();
    
    const userIndex = registrations.findIndex(r => r.id === userId);
    if (userIndex === -1) {
        return res.send(`
            <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">❌ Error</h1>
                <p>Invalid confirmation link or registration not found.</p>
            </body>
            </html>
        `);
    }
    
    const user = registrations[userIndex];
    
    // Check if already confirmed
    if (user.allocation?.status === 'Confirmed') {
        return res.send(`
            <html>
            <body style="font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa;">
                <div style="background: white; padding: 40px; border-radius: 10px; display: inline-block;">
                    <h1 style="color: #28a745;">✅ Already Confirmed</h1>
                    <p>Your participation has already been confirmed.</p>
                    <hr style="margin: 20px 0;">
                    <p><strong>Committee:</strong> ${user.allocation.committee}</p>
                    <p><strong>Portfolio:</strong> ${user.allocation.portfolio}</p>
                    <p><strong>Status:</strong> CONFIRMED</p>
                </div>
            </body>
            </html>
        `);
    }
    
    if (!user.allocation || user.allocation.status === 'Pending') {
        return res.send(`
            <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">❌ Error</h1>
                <p>No portfolio has been allotted to this registration.</p>
            </body>
            </html>
        `);
    }
    
    // Update status to Confirmed
    registrations[userIndex].allocation.status = 'Confirmed';
    registrations[userIndex].allocation.confirmedAt = new Date().toISOString();
    
    // Update portfolio status
    const { committee, portfolio, subCommittee } = user.allocation;
    if (committee === 'MOM' || committee === 'AIPPM') {
        const dept = portfolios[committee]?.[subCommittee];
        if (dept) {
            const portfolioIndex = dept.findIndex(p => p.name === portfolio);
            if (portfolioIndex !== -1) {
                portfolios[committee][subCommittee][portfolioIndex].status = 'Confirmed';
            }
        }
    } else {
        const portfolioIndex = portfolios[committee]?.findIndex(p => p.name === portfolio);
        if (portfolioIndex !== -1) {
            portfolios[committee][portfolioIndex].status = 'Confirmed';
        }
    }
    
    writePortfolios(portfolios);
    writeRegistrations(registrations);
    
    // Send confirmation page showing ONLY the confirmed portfolio
    res.send(generateConfirmationPage(user));
    
    // Send payment confirmation email
    await sendPaymentConfirmationEmail(user);
});

// Generate confirmation page for the ONE allotted portfolio
function generateConfirmationPage(user) {
    const tierNames = {
        tier1: 'Most Prestigious',
        tier2: 'Highly Prestigious',
        tier3: 'Prestigious',
        tier4: 'Intermediate',
        tier5: 'Entry Level',
        tier6: 'Beginner'
    };
    
    const tierName = user.allocation.tier ? tierNames[user.allocation.tier] : 'Standard';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .success-container {
            background: white;
            padding: 50px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 600px;
            animation: slideIn 0.5s ease;
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .success-icon {
            font-size: 80px;
            color: #28a745;
            margin-bottom: 20px;
            animation: bounce 0.5s ease;
        }
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            font-size: 32px;
        }
        .details-box {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            text-align: left;
        }
        .detail-row {
            margin: 15px 0;
            color: #555;
            font-size: 16px;
        }
        .detail-row strong {
            color: #333;
            display: inline-block;
            width: 150px;
        }
        .status-confirmed {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .next-steps {
            background: #e8f4f8;
            padding: 25px;
            border-radius: 15px;
            margin-top: 30px;
            text-align: left;
        }
        .next-steps h3 {
            color: #333;
            margin-bottom: 15px;
        }
        .next-steps ul {
            list-style: none;
            padding: 0;
        }
        .next-steps li {
            margin: 10px 0;
            padding-left: 25px;
            position: relative;
            color: #555;
        }
        .next-steps li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">✅</div>
        <h1>Payment Confirmed!</h1>
        <p style="color: #666; font-size: 18px; margin-bottom: 30px;">
            Your participation in MUN Conference 2025 is confirmed!
        </p>
        
        <div class="details-box">
            <h3 style="margin-bottom: 20px; color: #333;">Your Conference Details</h3>
            <div class="detail-row">
                <strong>Name:</strong> ${user.name}
            </div>
            <div class="detail-row">
                <strong>Email:</strong> ${user.email}
            </div>
            <div class="detail-row">
                <strong>Registration ID:</strong> MUN2025-${user.id}
            </div>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <div class="detail-row">
                <strong>Committee:</strong> ${user.allocation.committee}
            </div>
            <div class="detail-row">
                <strong>Portfolio:</strong> ${user.allocation.portfolio}
            </div>
            ${user.allocation.subCommittee ? `
            <div class="detail-row">
                <strong>Sub-Committee:</strong> ${user.allocation.subCommittee}
            </div>` : ''}
            <div class="detail-row">
                <strong>Portfolio Tier:</strong> ${tierName}
            </div>
            <div class="detail-row">
                <strong>Status:</strong> <span class="status-confirmed">CONFIRMED</span>
            </div>
        </div>
        
        <div class="next-steps">
            <h3>📌 Next Steps</h3>
            <ul>
                <li>Check your email for the payment receipt</li>
                <li>Join our WhatsApp group for updates</li>
                <li>Start researching your portfolio</li>
                <li>Prepare your position papers</li>
                <li>Mark your calendar: 15-17 March 2025</li>
            </ul>
        </div>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
            We look forward to seeing you at the conference!<br>
            For any queries, contact: munconference2025@gmail.com
        </p>
        
        <button onclick="window.print()" style="margin-top: 20px; padding: 12px 30px; background: #667eea; color: white; border: none; border-radius: 25px; cursor: pointer;">
            🖨️ Print This Page
        </button>
    </div>
</body>
</html>
    `;
}

// Send payment confirmation email for the ONE confirmed portfolio
async function sendPaymentConfirmationEmail(user) {
    const tierNames = {
        tier1: 'Most Prestigious',
        tier2: 'Highly Prestigious',
        tier3: 'Prestigious',
        tier4: 'Intermediate',
        tier5: 'Entry Level',
        tier6: 'Beginner'
    };
    
    const tierName = user.allocation.tier ? tierNames[user.allocation.tier] : 'Standard';
    
    try {
        const emailContent = {
            from: `MUN Conference 2025 <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '✅ Payment Confirmed - MUN Conference 2025',
            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f8f9fa; }
        .ticket { background: white; padding: 30px; border: 2px dashed #28a745; border-radius: 10px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Payment Confirmed!</h1>
            <p>Your seat is secured!</p>
        </div>
        <div class="content">
            <p>Dear ${user.name},</p>
            <p>Your payment for MUN Conference 2025 has been successfully confirmed!</p>
            
            <div class="ticket">
                <h3 style="text-align: center; color: #28a745;">🎫 YOUR CONFERENCE PASS</h3>
                <hr style="margin: 20px 0; border: none; border-top: 1px dashed #ccc;">
                <p><strong>Delegate Name:</strong> ${user.name}</p>
                <p><strong>Registration ID:</strong> MUN2025-${user.id}</p>
                <p><strong>Committee:</strong> ${user.allocation.committee}</p>
                <p><strong>Portfolio:</strong> ${user.allocation.portfolio}</p>
                ${user.allocation.subCommittee ? `<p><strong>Sub-Committee:</strong> ${user.allocation.subCommittee}</p>` : ''}
                <p><strong>Portfolio Tier:</strong> ${tierName}</p>
                <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">CONFIRMED ✅</span></p>
                <hr style="margin: 20px 0; border: none; border-top: 1px dashed #ccc;">
                <div style="text-align: center; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <p style="margin: 5px;"><strong>📅 Date:</strong> 15-17 March 2025</p>
                    <p style="margin: 5px;"><strong>📍 Venue:</strong> Convention Center, New Delhi</p>
                    <p style="margin: 5px;"><strong>⏰ Reporting:</strong> 8:30 AM</p>
                </div>
            </div>
            
            <h3>Important Instructions:</h3>
            <ul>
                <li>Please carry this email (printed or digital) to the venue</li>
                <li>Bring your college/school ID card</li>
                <li>Dress code: Western Formals</li>
                <li>Report at the registration desk by 8:30 AM on Day 1</li>
            </ul>
            
            <p style="margin-top: 30px; padding: 15px; background: #d4edda; border-radius: 8px; color: #155724;">
                <strong>Note:</strong> This email serves as your payment receipt and entry pass. Please save it for your records.
            </p>
        </div>
    </div>
</body>
</html>`
        };
        
        await transporter.sendMail(emailContent);
        console.log(`✅ Payment confirmation email sent to ${user.email}`);
    } catch (error) {
        console.error('❌ Failed to send payment confirmation email:', error);
    }
}

// API: Send reminder email for the ONE allotted portfolio
app.post('/api/send-reminder', async (req, res) => {
    const { userId } = req.body;
    
    const registrations = readRegistrations();
    const user = registrations.find(r => r.id === userId);
    
    if (!user || !user.allocation) {
        return res.status(404).json({ error: 'User or allocation not found' });
    }
    
    if (user.allocation.status === 'Confirmed') {
        return res.status(400).json({ error: 'User has already confirmed participation' });
    }
    
    const confirmationUrl = `http://localhost:${process.env.PORT || 3000}/api/confirm-payment/${userId}`;
    
    try {
        const emailContent = {
            from: `MUN Conference 2025 <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '⏰ Payment Reminder - MUN Conference 2025',
            html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px;">
        <h2 style="color: #ff6b6b;">⏰ Payment Reminder</h2>
        <p>Dear ${user.name},</p>
        <p>This is a reminder that your payment for MUN Conference 2025 is still pending.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Your Allotted Portfolio:</h3>
            <p><strong>Committee:</strong> ${user.allocation.committee}</p>
            <p><strong>Portfolio:</strong> ${user.allocation.portfolio}</p>
            ${user.allocation.subCommittee ? `<p><strong>Sub-Committee:</strong> ${user.allocation.subCommittee}</p>` : ''}
            <p><strong>Registration Fee:</strong> ₹500</p>
        </div>
        
        <p style="margin: 30px 0; text-align: center;">
            <a href="${confirmationUrl}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Confirm Payment Now
            </a>
        </p>
        
        <p style="color: #dc3545;"><strong>⚠️ Important:</strong> Please complete your payment within 48 hours to secure your portfolio.</p>
    </div>
</body>
</html>`
        };
        
        await transporter.sendMail(emailContent);
        console.log(`✅ Reminder sent to ${user.email}`);
        res.json({ success: true, message: 'Reminder sent successfully' });
    } catch (error) {
        console.error('❌ Reminder email error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📧 Email configured for: ${process.env.EMAIL_USER}`);
});