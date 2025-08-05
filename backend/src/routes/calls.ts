import { Router, Request, Response } from 'express';
import { startOutboundCall } from '../services/telnyx';
import numbersPool from '../../config/outboundNumbers.json';

const router = Router();

// Default fallback number for edge cases
const DEFAULT_FALLBACK_NUMBER = '+19704520286'; // Colorado number as default

// Area code to region mapping for geographic proximity
const areaCodeRegions: { [key: string]: { region: string; state: string; coordinates: [number, number] } } = {
  // Your current area codes
  '970': { region: 'Mountain', state: 'CO', coordinates: [39.5501, -105.7821] }, // Colorado
  '931': { region: 'Southeast', state: 'TN', coordinates: [35.7478, -86.6923] }, // Tennessee
  '930': { region: 'Southeast', state: 'TN', coordinates: [35.7478, -86.6923] }, // Tennessee
  '854': { region: 'Southeast', state: 'SC', coordinates: [34.0007, -81.0348] }, // South Carolina
  '804': { region: 'Southeast', state: 'VA', coordinates: [37.7693, -78.1700] }, // Virginia
  '656': { region: 'Unknown', state: 'Unknown', coordinates: [39.8283, -98.5795] }, // Unknown
  '641': { region: 'Midwest', state: 'IA', coordinates: [41.8780, -93.0977] }, // Iowa
  '567': { region: 'Midwest', state: 'OH', coordinates: [40.3888, -82.7649] }, // Ohio
  '443': { region: 'Northeast', state: 'MD', coordinates: [39.0458, -76.6413] }, // Maryland
  '435': { region: 'Mountain', state: 'UT', coordinates: [39.3210, -111.0937] }, // Utah
  
  // Common area codes for reference
  '212': { region: 'Northeast', state: 'NY', coordinates: [40.7128, -74.0060] }, // NYC
  '213': { region: 'West', state: 'CA', coordinates: [34.0522, -118.2437] }, // LA
  '312': { region: 'Midwest', state: 'IL', coordinates: [41.8781, -87.6298] }, // Chicago
  '404': { region: 'Southeast', state: 'GA', coordinates: [33.7490, -84.3880] }, // Atlanta
  '305': { region: 'Southeast', state: 'FL', coordinates: [25.7617, -80.1918] }, // Miami
  '702': { region: 'West', state: 'NV', coordinates: [36.1699, -115.1398] }, // Las Vegas
  '713': { region: 'South', state: 'TX', coordinates: [29.7604, -95.3698] }, // Houston
  '214': { region: 'South', state: 'TX', coordinates: [32.7767, -96.7970] }, // Dallas
  '415': { region: 'West', state: 'CA', coordinates: [37.7749, -122.4194] }, // San Francisco
  '617': { region: 'Northeast', state: 'MA', coordinates: [42.3601, -71.0589] }, // Boston
};

// Cache for distance calculations to improve performance
const distanceCache = new Map<string, number>();

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const cacheKey = `${lat1},${lon1},${lat2},${lon2}`;
  
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!;
  }
  
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Cache the result for future use
  distanceCache.set(cacheKey, distance);
  return distance;
}

// Find the nearest area code based on geographic proximity with enhanced fallbacks
function findNearestAreaCode(targetAreaCode: string, options: { 
  restrictToRegion?: string; 
  preferSameRegion?: boolean;
  maxDistance?: number;
} = {}): { nearestNumber: string; allDistances: Array<{number: string; areaCode: string; state: string; region: string; distance: number}> } {
  const targetRegion = areaCodeRegions[targetAreaCode];
  
  if (!targetRegion) {
    console.warn(`⚠️ Unknown area code: ${targetAreaCode} - using random selection`);
    return { 
      nearestNumber: numbersPool[Math.floor(Math.random() * numbersPool.length)],
      allDistances: []
    };
  }

  let nearestNumber = DEFAULT_FALLBACK_NUMBER;
  let shortestDistance = Infinity;
  let allDistances: Array<{number: string; areaCode: string; state: string; region: string; distance: number}> = [];
  let validNumbersFound = 0;

  for (const number of numbersPool) {
    const numberAreaCode = number.slice(2, 5);
    const numberRegion = areaCodeRegions[numberAreaCode];
    
    if (numberRegion) {
      const distance = calculateDistance(
        targetRegion.coordinates[0], targetRegion.coordinates[1],
        numberRegion.coordinates[0], numberRegion.coordinates[1]
      );
      
      // Apply region restriction if specified
      if (options.restrictToRegion && numberRegion.region !== options.restrictToRegion) {
        continue;
      }
      
      // Apply max distance filter if specified
      if (options.maxDistance && distance > options.maxDistance) {
        continue;
      }
      
      allDistances.push({
        number,
        areaCode: numberAreaCode,
        state: numberRegion.state,
        region: numberRegion.region,
        distance
      });
      
      validNumbersFound++;
      
      // Prefer same region if specified
      if (options.preferSameRegion && numberRegion.region === targetRegion.region) {
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestNumber = number;
        }
      } else if (!options.preferSameRegion && distance < shortestDistance) {
        shortestDistance = distance;
        nearestNumber = number;
      }
    }
  }

  // Sort by distance for better logging
  allDistances.sort((a, b) => a.distance - b.distance);
  
  // If no valid numbers found, use default fallback
  if (validNumbersFound === 0) {
    console.warn(`⚠️ No valid numbers found for area code ${targetAreaCode} - using default fallback`);
    return { 
      nearestNumber: DEFAULT_FALLBACK_NUMBER,
      allDistances: []
    };
  }

  return { nearestNumber, allDistances };
}

function pickBestFrom(to: string, options: { 
  restrictToRegion?: string; 
  preferSameRegion?: boolean;
  maxDistance?: number;
} = {}): string {
  const toArea = to.slice(2, 5); // Extract area code
  
  console.log(`📞 Processing call to: ${to} (Area code: ${toArea})`);
  
  // First, try exact match
  const exactMatch = numbersPool.find(n => n.slice(2, 5) === toArea);
  if (exactMatch) {
    console.log(`✅ Exact area code match found: ${exactMatch} for target ${toArea}`);
    return exactMatch;
  }
  
  // If no exact match, find nearest geographic area code
  const result = findNearestAreaCode(toArea, options);
  const nearestNumber = result.nearestNumber;
  const nearestAreaCode = nearestNumber.slice(2, 5);
  const targetRegion = areaCodeRegions[toArea];
  const nearestRegion = areaCodeRegions[nearestAreaCode];
  
  if (targetRegion && nearestRegion) {
    const distance = calculateDistance(
      targetRegion.coordinates[0], targetRegion.coordinates[1],
      nearestRegion.coordinates[0], nearestRegion.coordinates[1]
    );
    
    console.log(`🔄 No exact match for ${toArea}. Using nearest: ${nearestNumber} (${nearestRegion.state}, ${distance.toFixed(1)} miles away)`);
    
    // Log all available options for debugging
    if (result.allDistances.length > 0) {
      console.log(`📊 Available numbers ranked by distance:`);
      result.allDistances.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.number} (${item.state}, ${item.region}) - ${item.distance.toFixed(1)} miles`);
      });
    }
  } else {
    console.log(`🔄 No exact match for ${toArea}. Using random: ${nearestNumber}`);
  }
  
  return nearestNumber;
}

// POST /api/calls
router.post('/', async (req: Request, res: Response) => {
  try {
    const { toNumber, restrictToRegion, preferSameRegion, maxDistance } = req.body;
    // const user = req.user || { userId: 'test-user' }; // Use test user if no auth

    if (!toNumber) {
      return res.status(400).json({ message: 'Missing "toNumber" in request body.' });
    }

    // Format phone number to +E164 format
    let formattedToNumber = toNumber.replace(/\D/g, '');
    
    // Add + prefix if not present and number is valid
    if (formattedToNumber.length >= 10) {
      // If it's a US number (10 digits), add +1
      if (formattedToNumber.length === 10) {
        formattedToNumber = '+1' + formattedToNumber;
      }
      // If it's already 11 digits and starts with 1, add +
      else if (formattedToNumber.length === 11 && formattedToNumber.startsWith('1')) {
        formattedToNumber = '+' + formattedToNumber;
      }
      // If it's already in international format (12+ digits), add +
      else if (formattedToNumber.length >= 12) {
        formattedToNumber = '+' + formattedToNumber;
      }
      // Otherwise, assume it's a US number and add +1
      else {
        formattedToNumber = '+1' + formattedToNumber;
      }
    } else {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Enhanced area code matching with options
    const fromNumber = pickBestFrom(formattedToNumber, {
      restrictToRegion,
      preferSameRegion,
      maxDistance
    });

    // Test Telnyx call without database
    try {
      const { call_control_id } = await startOutboundCall({ fromNumber, toNumber: formattedToNumber });
      
      const roomId = `call_${call_control_id}`;

      return res.status(201).json({
        callId: 'test-call-id',
        roomId,
        callControlId: call_control_id,
        fromNumber,
        toNumber,
        message: 'Call initiated successfully'
      });
    } catch (telnyxError: any) {
      console.error('Telnyx error:', telnyxError.response?.data || telnyxError.message);
      return res.status(500).json({ 
        message: 'Telnyx call failed', 
        error: telnyxError.response?.data || telnyxError.message 
      });
    }

  } catch (error: any) {
    console.error('Error creating call:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to create call', error: error.message });
  }
});

// POST /api/calls/initiate - Frontend endpoint
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const { toNumber, restrictToRegion, preferSameRegion, maxDistance } = req.body;
    // const user = req.user || { userId: 'test-user' }; // Use test user if no auth

    if (!toNumber) {
      return res.status(400).json({ message: 'Missing "toNumber" in request body.' });
    }

    // Format phone number to +E164 format
    let formattedToNumber = toNumber.replace(/\D/g, '');
    
    // Add + prefix if not present and number is valid
    if (formattedToNumber.length >= 10) {
      // If it's a US number (10 digits), add +1
      if (formattedToNumber.length === 10) {
        formattedToNumber = '+1' + formattedToNumber;
      }
      // If it's already 11 digits and starts with 1, add +
      else if (formattedToNumber.length === 11 && formattedToNumber.startsWith('1')) {
        formattedToNumber = '+' + formattedToNumber;
      }
      // If it's already in international format (12+ digits), add +
      else if (formattedToNumber.length >= 12) {
        formattedToNumber = '+' + formattedToNumber;
      }
      // Otherwise, assume it's a US number and add +1
      else {
        formattedToNumber = '+1' + formattedToNumber;
      }
    } else {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Enhanced area code matching with options
    const fromNumber = pickBestFrom(formattedToNumber, {
      restrictToRegion,
      preferSameRegion,
      maxDistance
    });

    // Test Telnyx call without database
    try {
      const { call_control_id } = await startOutboundCall({ fromNumber, toNumber: formattedToNumber });
      
      const roomId = `call_${call_control_id}`;

      return res.status(201).json({
        callId: 'test-call-id',
        roomId,
        callControlId: call_control_id,
        fromNumber,
        toNumber,
        message: 'Call initiated successfully'
      });
    } catch (telnyxError: any) {
      console.error('Telnyx error:', telnyxError.response?.data || telnyxError.message);
      return res.status(500).json({ 
        message: 'Telnyx call failed', 
        error: telnyxError.response?.data || telnyxError.message 
      });
    }

  } catch (error: any) {
    console.error('Error creating call:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to create call', error: error.message });
  }
});

// POST /api/calls/hangup - Hang up an active call
router.post('/hangup', async (req: Request, res: Response) => {
  try {
    const { callControlId } = req.body;
    // const user = req.user || { userId: 'test-user' }; // Use test user if no auth

    if (!callControlId) {
      return res.status(400).json({ message: 'Missing "callControlId" in request body.' });
    }

    console.log('📞 Hanging up call with control ID:', callControlId);

    // Call Telnyx API to hang up the call
    try {
      const response = await fetch(`https://api.telnyx.com/v2/call_control/${callControlId}/actions/hangup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telnyx hangup error:', errorData);
        return res.status(response.status).json({ 
          message: 'Failed to hang up call', 
          error: errorData 
        });
      }

      console.log('✅ Call hung up successfully:', callControlId);

      return res.status(200).json({
        message: 'Call hung up successfully',
        callControlId
      });

    } catch (telnyxError: any) {
      console.error('Telnyx hangup error:', telnyxError.response?.data || telnyxError.message);
      return res.status(500).json({ 
        message: 'Failed to hang up call', 
        error: telnyxError.response?.data || telnyxError.message 
      });
    }

  } catch (error: any) {
    console.error('Error hanging up call:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to hang up call', error: error.message });
  }
});

export default router;
 