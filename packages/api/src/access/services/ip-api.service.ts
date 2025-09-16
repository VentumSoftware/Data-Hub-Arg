// src/access/services/ip-api.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface LocationInfo {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  organization: string;
  asn: string;
  isValid: boolean;
  errorMessage?: string;
}

@Injectable()
export class IpApiService {
  private readonly logger = new Logger(IpApiService.name);
  private readonly baseUrl = 'http://ip-api.com/json';
  
  /**
   * Get location information for an IP address from ip-api.com
   * @param ipAddress - IP address to lookup
   * @returns Promise<LocationInfo> - Location information
   */
  async getLocationInfo(ipAddress: string): Promise<LocationInfo> {
    try {
      // Handle localhost and private IPs
      if (this.isLocalOrPrivateIP(ipAddress)) {
        return this.createDefaultLocationInfo(ipAddress, 'Private/Local IP address');
      }

      const url = `${this.baseUrl}/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
      
      this.logger.debug(`Fetching location info for IP: ${ipAddress}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Proyectia-Backend/1.0'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'fail') {
        this.logger.warn(`IP API lookup failed for ${ipAddress}: ${data.message}`);
        return this.createDefaultLocationInfo(ipAddress, data.message || 'Unknown error');
      }

      // Transform API response to our interface
      return {
        ip: data.query,
        country: data.country || 'Unknown',
        countryCode: data.countryCode || '',
        region: data.region || '',
        regionName: data.regionName || 'Unknown',
        city: data.city || 'Unknown',
        zip: data.zip || '',
        latitude: data.lat || 0,
        longitude: data.lon || 0,
        timezone: data.timezone || '',
        isp: data.isp || 'Unknown',
        organization: data.org || 'Unknown',
        asn: data.as || 'Unknown',
        isValid: true
      };

    } catch (error) {
      this.logger.error(`Failed to fetch location info for IP ${ipAddress}:`, error.message);
      
      // Return default info on error
      return this.createDefaultLocationInfo(
        ipAddress, 
        `API request failed: ${error.message}`
      );
    }
  }

  /**
   * Check if IP is localhost or private network
   */
  private isLocalOrPrivateIP(ip: string): boolean {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
      return true;
    }

    // Check for private IP ranges
    const privateRanges = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^169\.254\./,              // 169.254.0.0/16 (link-local)
      /^::1$/,                    // IPv6 localhost
      /^fe80::/,                  // IPv6 link-local
      /^fc00::/,                  // IPv6 unique local
      /^fd00::/                   // IPv6 unique local
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Create default location info for invalid/private IPs
   */
  private createDefaultLocationInfo(ip: string, errorMessage: string): LocationInfo {
    return {
      ip,
      country: 'Unknown',
      countryCode: '',
      region: '',
      regionName: 'Unknown',
      city: 'Unknown',
      zip: '',
      latitude: 0,
      longitude: 0,
      timezone: '',
      isp: 'Unknown',
      organization: 'Unknown',
      asn: 'Unknown',
      isValid: false,
      errorMessage
    };
  }
}