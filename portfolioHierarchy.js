// Portfolio Hierarchy and Point System
const portfolioTiers = {
    // Tier 1: Most Prestigious (100 points) - Requires 10+ MUNs, 5+ Best Delegates
    tier1: {
        points: 100,
        minExperience: 10,
        minBestDelegate: 5,
        portfolios: {
            UNSC: ['United States (P5)', 'China (P5)', 'Russia (P5)', 'United Kingdom (P5)', 'France (P5)'],
            UNGA: ['United States', 'China', 'Russia', 'United Kingdom', 'India'],
            UNHRC: ['United States', 'China', 'United Kingdom', 'Germany', 'France'],
            MOM: ['Albus Dumbledore - Chief Warlock', 'Harry Potter - Head Auror', 'Saul Croaker - Head Unspeakable'],
            AIPPM: ['Narendra Modi - Prime Minister', 'Rahul Gandhi - Party Leader', 'Arvind Kejriwal - Party Convener']
        }
    },
    
    // Tier 2: Highly Prestigious (75 points) - Requires 7+ MUNs, 3+ Best Delegates
    tier2: {
        points: 75,
        minExperience: 7,
        minBestDelegate: 3,
        portfolios: {
            UNSC: ['Japan', 'Germany', 'India', 'Brazil', 'South Africa'],
            UNGA: ['Germany', 'Japan', 'France', 'Brazil', 'Canada', 'Australia', 'Israel', 'Saudi Arabia'],
            UNHRC: ['Japan', 'India', 'Brazil', 'Canada', 'Australia', 'Israel'],
            UNCSW: ['Germany', 'Japan', 'Canada', 'Australia', 'India'],
            WHO: ['United States', 'China', 'Germany', 'United Kingdom', 'Japan'],
            MOM: ['Kingsley Shacklebolt - Senior Auror', 'Amelia Bones - Department Head', 'Cornelius Fudge - Minister'],
            AIPPM: ['Amit Shah - Home Minister', 'Mamata Banerjee - Party Chief & CM', 'M.K. Stalin - Chief Minister']
        }
    },
    
    // Tier 3: Prestigious (50 points) - Requires 5+ MUNs, 2+ Best Delegates
    tier3: {
        points: 50,
        minExperience: 5,
        minBestDelegate: 2,
        portfolios: {
            UNSC: ['Algeria', 'Ecuador', 'Malta', 'Switzerland', 'Slovenia'],
            UNGA: ['South Korea', 'Mexico', 'Indonesia', 'Turkey', 'Argentina', 'Egypt', 'Nigeria', 'Pakistan'],
            UNHRC: ['Mexico', 'Argentina', 'South Africa', 'South Korea', 'Indonesia'],
            UNCSW: ['Brazil', 'Mexico', 'South Africa', 'Egypt', 'Nigeria'],
            WHO: ['India', 'Brazil', 'France', 'Canada', 'Australia', 'South Korea'],
            MOM: ['Nymphadora Tonks - Auror', 'Ron Weasley - Auror', 'Arthur Weasley - Muggle Protection'],
            AIPPM: ['Rajnath Singh - Defence Minister', 'Shashi Tharoor - MP', 'Bhagwant Mann - Punjab CM']
        }
    },
    
    // Tier 4: Intermediate (30 points) - Requires 3+ MUNs, 1+ Best Delegate
    tier4: {
        points: 30,
        minExperience: 3,
        minBestDelegate: 1,
        portfolios: {
            UNSC: ['Guyana', 'Mozambique', 'Sierra Leone', 'Republic of Korea'],
            UNGA: ['Ukraine', 'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland'],
            UNHRC: ['Poland', 'Netherlands', 'Belgium', 'Czech Republic', 'Romania'],
            UNCSW: ['Poland', 'Denmark', 'Belgium', 'Ireland', 'Spain'],
            WHO: ['Mexico', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden'],
            MOM: ['Gawain Robards - Office Head', 'Ludovic Bagman - Department Head', 'Percy Weasley - Junior Assistant'],
            AIPPM: ['Mallikarjun Kharge - Party President', 'Sharad Pawar - Party President', 'Akhilesh Yadav - Party President']
        }
    },
    
    // Tier 5: Entry Level (15 points) - Requires 1+ MUNs
    tier5: {
        points: 15,
        minExperience: 1,
        minBestDelegate: 0,
        portfolios: {
            // All remaining portfolios not in tiers 1-4
        }
    },
    
    // Tier 6: Beginner (10 points) - No requirements
    tier6: {
        points: 10,
        minExperience: 0,
        minBestDelegate: 0,
        portfolios: {
            // Countries with smaller international influence
        }
    }
};

// Special bonus points
const bonusPoints = {
    // Award bonuses
    bestDelegate: 5,          // Per award
    specialMention: 3,         // Per award
    verbalMention: 1,          // Per award
    
    // Experience bonuses
    experienceRanges: {
        '0': 0,
        '1': 5,
        '2': 10,
        '3': 15,
        '4': 20,
        '5': 25,
        '6-10': 35,
        '11-20': 50,
        '21-30': 70,
        '30+': 100
    },
    
    // Committee difficulty multipliers
    committeeMultipliers: {
        'UNSC': 1.5,      // Most difficult
        'AIPPM': 1.4,     // Highly specialized
        'MOM': 1.4,       // Highly specialized
        'UNHRC': 1.2,     // Challenging
        'UNCSW': 1.1,     // Moderately challenging
        'WHO': 1.1,       // Moderately challenging
        'UNGA': 1.0       // Standard difficulty
    }
};

// Function to calculate user's total points
function calculateUserPoints(userData) {
    let totalPoints = 0;
    
    // Experience points
    totalPoints += bonusPoints.experienceRanges[userData.experience] || 0;
    
    // Award points
    totalPoints += (userData.bestDelegate || 0) * bonusPoints.bestDelegate;
    totalPoints += (userData.specialMention || 0) * bonusPoints.specialMention;
    totalPoints += (userData.verbalMention || 0) * bonusPoints.verbalMention;
    
    return totalPoints;
}

// Function to get portfolio tier and check eligibility
function getPortfolioTierAndEligibility(portfolio, committee, userData) {
    const userPoints = calculateUserPoints(userData);
    const userBestDelegates = parseInt(userData.bestDelegate) || 0;
    const userExperience = parseInt(userData.experience?.replace('+', '').split('-')[0]) || 0;
    
    // Check each tier from highest to lowest
    for (const [tierName, tierData] of Object.entries(portfolioTiers)) {
        if (tierData.portfolios[committee]?.includes(portfolio)) {
            const isEligible = userExperience >= tierData.minExperience && 
                              userBestDelegates >= tierData.minBestDelegate;
            
            return {
                tier: tierName,
                points: tierData.points,
                isEligible,
                requiredExperience: tierData.minExperience,
                requiredBestDelegates: tierData.minBestDelegate,
                userExperience,
                userBestDelegates,
                userPoints,
                multiplier: bonusPoints.committeeMultipliers[committee] || 1.0
            };
        }
    }
    
    // Default to tier 5 if not found in specific tiers
    return {
        tier: 'tier5',
        points: portfolioTiers.tier5.points,
        isEligible: userExperience >= portfolioTiers.tier5.minExperience,
        requiredExperience: portfolioTiers.tier5.minExperience,
        requiredBestDelegates: portfolioTiers.tier5.minBestDelegate,
        userExperience,
        userBestDelegates,
        userPoints,
        multiplier: bonusPoints.committeeMultipliers[committee] || 1.0
    };
}

// Function to calculate final allocation score
function calculateAllocationScore(portfolio, committee, userData, preferenceNumber) {
    const tierInfo = getPortfolioTierAndEligibility(portfolio, committee, userData);
    
    if (!tierInfo.isEligible) {
        return {
            score: 0,
            eligible: false,
            reason: `Requires ${tierInfo.requiredExperience}+ MUNs and ${tierInfo.requiredBestDelegates}+ Best Delegates`,
            tierInfo
        };
    }
    
    // Calculate score with various factors
    let score = tierInfo.points * tierInfo.multiplier;
    
    // Preference penalty (lower preference = higher penalty)
    const preferencePenalty = 1 - (preferenceNumber - 1) * 0.15; // 15% reduction per preference level
    score *= preferencePenalty;
    
    // User experience bonus
    score += tierInfo.userPoints * 0.5;
    
    return {
        score: Math.round(score),
        eligible: true,
        tierInfo,
        preferenceNumber
    };
}

module.exports = {
    portfolioTiers,
    bonusPoints,
    calculateUserPoints,
    getPortfolioTierAndEligibility,
    calculateAllocationScore
};