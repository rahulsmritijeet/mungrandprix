const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import portfolio hierarchy system
const {
    calculateUserPoints,
    getPortfolioTierAndEligibility,
    calculateAllocationScore
} = require('./portfolioHierarchy');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/registration_system', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Enhanced Registration Schema with Points
const registrationSchema = new mongoose.Schema({
    registrationId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date, required: true },
    class: { type: String, required: true },
    school: { type: String, required: true },
    
    // Experience tracking
    experience: {
        totalConferences: String,
        bestDelegate: Number,
        specialMention: Number,
        verbalMention: Number,
        participation: Number,
        details: String
    },
    
    // Points and eligibility
    points: {
        total: Number,
        breakdown: {
            experience: Number,
            awards: Number,
            bestDelegate: Number,
            specialMention: Number,
            verbalMention: Number
        }
    },
    
    // Committee preferences with eligibility
    preferences: [{
        preferenceNumber: Number,
        committee: String,
        portfolios: [{
            choice: Number,
            portfolio: String,
            tier: String,
            points: Number,
            eligible: Boolean,
            score: Number
        }],
        specialData: Object
    }],
    
    // Allocation details
    allocation: {
        committee: String,
        portfolio: String,
        tier: String,
        score: Number,
        rank: Number // Rank in allocation queue
    },
    
    status: {
        type: String,
        enum: ['pending', 'allotted', 'confirmed', 'waitlisted', 'rejected', 'cancelled'],
        default: 'pending'
    },
    
    paymentCode: { type: String },
    allottedAt: Date,
    confirmedAt: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Registration = mongoose.model('Registration', registrationSchema);

// Statistics Schema for tracking allocation
const statisticsSchema = new mongoose.Schema({
    committee: String,
    portfolio: String,
    totalSeats: { type: Number, default: 1 },
    allotted: { type: Number, default: 0 },
    confirmed: { type: Number, default: 0 },
    tier: String,
    minPointsRequired: Number,
    currentMinPoints: Number,
    updatedAt: { type: Date, default: Date.now }
});

const Statistics = mongoose.model('Statistics', statisticsSchema);

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper function to check allocation limits (25% allotted, 10% confirmed)
async function checkAllocationLimits() {
    const totalRegistrations = await Registration.countDocuments();
    const allottedCount = await Registration.countDocuments({ status: 'allotted' });
    const confirmedCount = await Registration.countDocuments({ status: 'confirmed' });
    
    const allottedPercentage = (allottedCount / totalRegistrations) * 100;
    const confirmedPercentage = (confirmedCount / totalRegistrations) * 100;
    
    return {
        totalRegistrations,
        allottedCount,
        confirmedCount,
        allottedPercentage,
        confirmedPercentage,
        canAllot: allottedPercentage < 25,
        stats: {
            allottedLimit: Math.floor(totalRegistrations * 0.25),
            confirmedLimit: Math.floor(totalRegistrations * 0.10),
            remainingAllotments: Math.max(0, Math.floor(totalRegistrations * 0.25) - allottedCount)
        }
    };
}

// Allocation algorithm based on points
async function allocatePortfolio(registrationData) {
    const userPoints = calculateUserPoints(registrationData.experience);
    let bestAllocation = null;
    let highestScore = 0;
    
    // Check each preference
    for (const pref of registrationData.preferences) {
        for (const portfolioChoice of pref.portfolios) {
            if (!portfolioChoice.portfolio) continue;
            
            const allocationScore = calculateAllocationScore(
                portfolioChoice.portfolio,
                pref.committee,
                registrationData.experience,
                pref.preferenceNumber
            );
            
            if (allocationScore.eligible && allocationScore.score > highestScore) {
                // Check if portfolio is available
                const existingAllocation = await Registration.findOne({
                    'allocation.committee': pref.committee,
                    'allocation.portfolio': portfolioChoice.portfolio,
                    status: { $in: ['allotted', 'confirmed'] }
                });
                
                if (!existingAllocation) {
                    highestScore = allocationScore.score;
                    bestAllocation = {
                        committee: pref.committee,
                        portfolio: portfolioChoice.portfolio,
                        tier: allocationScore.tierInfo.tier,
                        score: allocationScore.score
                    };
                }
            }
        }
    }
    
    return bestAllocation;
}

// Routes

// 1. Enhanced Registration endpoint with point calculation
app.post('/api/register', async (req, res) => {
    try {
        const { 
            fullName, 
            email, 
            phone, 
            dob, 
            class: userClass, 
            school,
            experience,
            bestDelegate,
            specialMention,
            verbalMention,
            participation,
            experienceDetails,
            preferences 
        } = req.body;

        // Check if email already registered
        const existingReg = await Registration.findOne({ email });
        if (existingReg) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered' 
            });
        }

        // Check allocation limits
        const limits = await checkAllocationLimits();
        if (!limits.canAllot) {
            return res.status(400).json({ 
                success: false, 
                message: 'Registration limit reached. You have been added to the waitlist.',
                waitlist: true
            });
        }

        // Calculate user points
        const experienceData = {
            experience,
            bestDelegate: parseInt(bestDelegate) || 0,
            specialMention: parseInt(specialMention) || 0,
            verbalMention: parseInt(verbalMention) || 0,
            participation: parseInt(participation) || 0
        };
        
        const userPoints = calculateUserPoints(experienceData);
        
        // Process preferences with eligibility check
        const processedPreferences = [];
        let eligibilityWarnings = [];
        
        for (const pref of preferences) {
            const processedPortfolios = [];
            
            for (const portfolioChoice of pref.portfolios) {
                if (portfolioChoice.portfolio) {
                    const tierInfo = getPortfolioTierAndEligibility(
                        portfolioChoice.portfolio,
                        pref.committee,
                        experienceData
                    );
                    
                    processedPortfolios.push({
                        choice: portfolioChoice.choice,
                        portfolio: portfolioChoice.portfolio,
                        tier: tierInfo.tier,
                        points: tierInfo.points,
                        eligible: tierInfo.isEligible,
                        score: tierInfo.isEligible ? 
                               Math.round(tierInfo.points * tierInfo.multiplier) : 0
                    });
                    
                    if (!tierInfo.isEligible) {
                        eligibilityWarnings.push({
                            committee: pref.committee,
                            portfolio: portfolioChoice.portfolio,
                            reason: `Requires ${tierInfo.requiredExperience}+ MUNs and ${tierInfo.requiredBestDelegates}+ Best Delegates`
                        });
                    }
                }
            }
            
            processedPreferences.push({
                preferenceNumber: pref.preferenceNumber,
                committee: pref.committee,
                portfolios: processedPortfolios,
                specialData: pref.specialData
            });
        }

        // Attempt allocation
        const allocation = await allocatePortfolio({
            experience: experienceData,
            preferences: processedPreferences
        });

        if (!allocation) {
            return res.status(400).json({
                success: false,
                message: 'No eligible portfolios available based on your experience level',
                eligibilityWarnings,
                userPoints
            });
        }

        // Generate payment code
        const paymentCode = 'PAY-' + uuidv4().substring(0, 8).toUpperCase();

        // Create registration
        const registration = new Registration({
            registrationId: 'REG-' + Date.now(),
            name: fullName,
            email,
            phone,
            dob,
            class: userClass,
            school,
            experience: {
                totalConferences: experience,
                bestDelegate: parseInt(bestDelegate) || 0,
                specialMention: parseInt(specialMention) || 0,
                verbalMention: parseInt(verbalMention) || 0,
                participation: parseInt(participation) || 0,
                details: experienceDetails
            },
            points: {
                total: userPoints,
                breakdown: {
                    experience: experienceData.experience,
                    bestDelegate: (parseInt(bestDelegate) || 0) * 5,
                    specialMention: (parseInt(specialMention) || 0) * 3,
                    verbalMention: (parseInt(verbalMention) || 0) * 1,
                    awards: ((parseInt(bestDelegate) || 0) * 5) + 
                            ((parseInt(specialMention) || 0) * 3) + 
                            ((parseInt(verbalMention) || 0) * 1)
                }
            },
            preferences: processedPreferences,
            allocation,
            status: 'allotted',
            paymentCode,
            allottedAt: new Date()
        });

        await registration.save();

        // Update statistics
        await Statistics.findOneAndUpdate(
            { 
                committee: allocation.committee, 
                portfolio: allocation.portfolio 
            },
            {
                $inc: { allotted: 1 },
                $set: { 
                    tier: allocation.tier,
                    currentMinPoints: allocation.score,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        // Send enhanced confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: '🎉 MUN Grand Prix - Portfolio Allocated!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Arial', sans-serif; background: #f5f5f5; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                        .content { padding: 30px; }
                        .portfolio-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
                        .points-summary { display: flex; justify-content: space-around; margin: 20px 0; }
                        .point-item { text-align: center; padding: 10px; }
                        .point-value { font-size: 24px; font-weight: bold; color: #667eea; }
                        .payment-code { background: #fff3cd; border: 2px dashed #ffc107; padding: 20px; text-align: center; margin: 20px 0; }
                        .payment-code h2 { color: #856404; margin: 10px 0; font-size: 28px; }
                        .tier-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
                        .tier-1 { background: #ffd700; color: #000; }
                        .tier-2 { background: #c0c0c0; color: #000; }
                        .tier-3 { background: #cd7f32; color: #fff; }
                        .tier-4 { background: #4a90e2; color: #fff; }
                        .tier-5 { background: #7b68ee; color: #fff; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🏆 Congratulations ${fullName}!</h1>
                            <p>Your MUN Grand Prix Registration is Successful</p>
                        </div>
                        
                        <div class="content">
                            <h2>📋 Registration Details</h2>
                            <p><strong>Registration ID:</strong> ${registration.registrationId}</p>
                            <p><strong>Status:</strong> <span style="color: #28a745;">ALLOTTED (Payment Pending)</span></p>
                            
                            <div class="portfolio-box">
                                <h3>🎯 Allocated Portfolio</h3>
                                <p><strong>Committee:</strong> ${allocation.committee}</p>
                                <p><strong>Portfolio:</strong> ${allocation.portfolio}</p>
                                <p><strong>Tier:</strong> <span class="tier-badge tier-${allocation.tier.replace('tier', '')}">${allocation.tier.toUpperCase()}</span></p>
                                <p><strong>Allocation Score:</strong> ${allocation.score} points</p>
                            </div>
                            
                            <div class="points-summary">
                                <div class="point-item">
                                    <div class="point-value">${userPoints}</div>
                                    <div>Total Points</div>
                                </div>
                                <div class="point-item">
                                    <div class="point-value">${experienceData.bestDelegate || 0}</div>
                                    <div>Best Delegates</div>
                                </div>
                                <div class="point-item">
                                    <div class="point-value">${allocation.tier.replace('tier', '')}</div>
                                    <div>Portfolio Tier</div>
                                </div>
                            </div>
                            
                            <div class="payment-code">
                                <h3>⚠️ Action Required: Confirm Your Seat</h3>
                                <p>Reply to this email with the following payment code:</p>
                                <h2>${paymentCode}</h2>
                                <p style="color: #856404; font-size: 12px;">
                                    This code expires in 24 hours. Your seat will be released if not confirmed.
                                </p>
                            </div>
                            
                            ${eligibilityWarnings.length > 0 ? `
                                <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                                    <h4 style="color: #721c24;">⚠️ Some Preferences Were Ineligible</h4>
                                    <ul style="margin: 10px 0;">
                                        ${eligibilityWarnings.map(w => 
                                            `<li>${w.committee} - ${w.portfolio}: ${w.reason}</li>`
                                        ).join('')}
                                    </ul>
                                    <p style="font-size: 12px; color: #721c24;">
                                        You were allocated the best eligible portfolio based on your experience.
                                    </p>
                                </div>
                            ` : ''}
                            
                            <div style="background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0;">
                                <h4 style="color: #004085;">📊 Allocation Statistics</h4>
                                <p>Total Registrations: ${limits.totalRegistrations}</p>
                                <p>Seats Allotted: ${limits.allottedCount + 1}/${limits.stats.allottedLimit} (${Math.round(limits.allottedPercentage)}%)</p>
                                <p>Seats Confirmed: ${limits.confirmedCount}/${limits.stats.confirmedLimit} (${Math.round(limits.confirmedPercentage)}%)</p>
                            </div>
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
                            
                            <p style="text-align: center; color: #666;">
                                Best regards,<br>
                                <strong>MUN Grand Prix Team</strong>
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({
            success: true,
            message: 'Registration successful! Check your email for payment instructions.',
            data: {
                registrationId: registration.registrationId,
                status: registration.status,
                allocation,
                userPoints,
                eligibilityWarnings
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Registration failed', 
            error: error.message 
        });
    }
});

// 2. Get allocation statistics
app.get('/api/statistics', async (req, res) => {
    try {
        const limits = await checkAllocationLimits();
        const stats = await Statistics.find().sort({ currentMinPoints: -1 });
        
        // Get tier distribution
        const tierDistribution = await Registration.aggregate([
            { $match: { status: { $in: ['allotted', 'confirmed'] } } },
            { $group: { 
                _id: '$allocation.tier', 
                count: { $sum: 1 },
                avgScore: { $avg: '$allocation.score' }
            }},
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            success: true,
            data: {
                limits,
                portfolioStats: stats,
                tierDistribution
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching statistics', 
            error: error.message 
        });
    }
});

// 3. Check eligibility for specific portfolio
app.post('/api/check-eligibility', async (req, res) => {
    try {
        const { portfolio, committee, experience, bestDelegate } = req.body;
        
        const userData = {
            experience,
            bestDelegate: parseInt(bestDelegate) || 0
        };
        
        const tierInfo = getPortfolioTierAndEligibility(portfolio, committee, userData);
        
        res.json({
            success: true,
            data: {
                eligible: tierInfo.isEligible,
                tier: tierInfo.tier,
                points: tierInfo.points,
                requirements: {
                    experience: tierInfo.requiredExperience,
                    bestDelegates: tierInfo.requiredBestDelegates
                },
                userStats: {
                    experience: tierInfo.userExperience,
                    bestDelegates: tierInfo.userBestDelegates,
                    totalPoints: tierInfo.userPoints
                }
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error checking eligibility', 
            error: error.message 
        });
    }
});

// 4. Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await Registration.find({ 
            status: { $in: ['allotted', 'confirmed'] } 
        })
        .select('name school points allocation status')
        .sort({ 'points.total': -1 })
        .limit(50);
        
        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching leaderboard', 
            error: error.message 
        });
    }
});

// 5. Confirm payment (existing endpoint enhanced)
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { email, paymentCode } = req.body;

        const registration = await Registration.findOne({ 
            email, 
            status: 'allotted' 
        });

        if (!registration) {
            return res.status(404).json({ 
                success: false, 
                message: 'No pending registration found for this email' 
            });
        }

        if (registration.paymentCode !== paymentCode) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid payment code' 
            });
        }

        // Update status
        registration.status = 'confirmed';
        registration.confirmedAt = new Date();
        await registration.save();

        // Update statistics
        await Statistics.findOneAndUpdate(
            { 
                committee: registration.allocation.committee, 
                portfolio: registration.allocation.portfolio 
            },
            {
                $inc: { confirmed: 1, allotted: -1 }
            }
        );

        // Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: '✅ MUN Grand Prix - Registration Confirmed!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #28a745;">Payment Confirmed!</h2>
                    <p>Dear ${registration.name},</p>
                    <p>Your registration is now <strong>CONFIRMED</strong>.</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3>Final Details:</h3>
                        <p><strong>Registration ID:</strong> ${registration.registrationId}</p>
                        <p><strong>Committee:</strong> ${registration.allocation.committee}</p>
                        <p><strong>Portfolio:</strong> ${registration.allocation.portfolio}</p>
                        <p><strong>Tier:</strong> ${registration.allocation.tier.toUpperCase()}</p>
                        <p><strong>Status:</strong> ✅ CONFIRMED</p>
                    </div>
                    
                    <p>We look forward to seeing you at the conference!</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({
            success: true,
            message: 'Payment confirmed successfully!',
            data: {
                registrationId: registration.registrationId,
                status: registration.status
            }
        });

    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Payment confirmation failed', 
            error: error.message 
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Registration API: http://localhost:${PORT}/api/register`);
    console.log(`Statistics API: http://localhost:${PORT}/api/statistics`);
    console.log(`Leaderboard API: http://localhost:${PORT}/api/leaderboard`);
});