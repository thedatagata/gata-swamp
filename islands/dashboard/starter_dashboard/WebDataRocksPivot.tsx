// islands/dashboard/starter_dashboard/WebDataRocksPivot.tsx
import { useEffect, useRef, useState } from "preact/hooks";
import { 
  generateSliceObject, 
  getFieldMetadata 
} from "../../../utils/semantic/slice-object-generator.ts";

interface WebDataRocksPivotProps {
  data: any[];
  initialSlice?: any;
  onReportComplete?: (pivot: any) => void;
  onLoadError?: (error: string) => void;
}

export default function WebDataRocksPivot({ 
  data, 
  initialSlice, 
  onReportComplete,
  onLoadError 
}: WebDataRocksPivotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pivotRef = useRef<any>(null);
  const loadTimeoutRef = useRef<number | null>(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Load WebDataRocks assets dynamically
  useEffect(() => {
    if (assetsLoaded) return;

    const loadAssets = async () => {
      // Load CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = '/webdatarocks.min.css';
      document.head.appendChild(cssLink);

      // Load toolbar JS
      const toolbarScript = document.createElement('script');
      toolbarScript.src = '/webdatarocks.toolbar.min.js';
      document.head.appendChild(toolbarScript);

      // Load main WebDataRocks JS
      const mainScript = document.createElement('script');
      mainScript.src = '/webdatarocks.js';
      document.head.appendChild(mainScript);

      await new Promise((resolve) => {
        mainScript.onload = resolve;
      });

      console.log('✅ WebDataRocks assets loaded');
      setAssetsLoaded(true); // Trigger re-render
    };

    loadAssets();
  }, [assetsLoaded]);

  useEffect(() => {
    if (!assetsLoaded) {
      console.log('⏳ Waiting for WebDataRocks assets to load...');
      return;
    }
    
    if (!containerRef.current || !data || data.length === 0) {
      console.log('WebDataRocksPivot: Missing container, data, or empty data', {
        hasContainer: !!containerRef.current,
        hasData: !!data,
        dataLength: data?.length || 0
      });
      return;
    }
    if (typeof window === 'undefined' || !(window as any).WebDataRocks) {
      console.log('WebDataRocksPivot: WebDataRocks not available');
      return;
    }

    console.log('WebDataRocksPivot: Initializing', {
      rowCount: data.length,
      hasInitialSlice: !!initialSlice,
      containerReady: !!containerRef.current
    });

    // Sanitize data
    const sanitizedData = deepSanitize(data);
    
    // Test JSON serialization
    try {
      JSON.stringify(sanitizedData.slice(0, 5));
      console.log('WebDataRocksPivot: ✅ Data is serializable');
    } catch (e) {
      console.error('WebDataRocksPivot: ❌ Serialization failed:', e);
      return;
    }
    
    const WebDataRocks = (window as any).WebDataRocks;

    if (pivotRef.current) {
      pivotRef.current.dispose();
    }

    // Extract columns and build metadata
    const columns = sanitizedData.length > 0 ? Object.keys(sanitizedData[0]) : [];
    console.log('WebDataRocksPivot: Detected columns:', columns);

    const metadataObject = buildUsersMetadata(columns);
    const dataWithMetadata = [metadataObject, ...sanitizedData];
    console.log('WebDataRocksPivot: ✅ Prepended metadata object');

    // Generate or use provided slice
    const slice = initialSlice || generateSliceObject(columns);
    console.log('WebDataRocksPivot: Generated slice:', slice);

    // Initialize with slice in the report config
    pivotRef.current = new WebDataRocks({
      container: containerRef.current,
      toolbar: true,
      height: 600,
      report: {
        dataSource: {
          data: dataWithMetadata
        },
        slice: slice,  // Add slice here alongside dataSource
        options: {
          showDefaultSlice: false,  // Keep this false
          grid: {
            type: "compact",
            showTotals: "on",
            showGrandTotals: "on"
          }
        }
      }
    });

    // Set timeout to detect 1MB limit (10 seconds)
    loadTimeoutRef.current = window.setTimeout(() => {
      if (onLoadError) {
        console.error('❌ Data load timeout - likely exceeded 1MB limit');
        onLoadError('Data load timeout - likely exceeded 1MB limit');
      }
    }, 10000);

    // Simple reportcomplete handler
    pivotRef.current.on('reportcomplete', function() {
      console.log('📊 Report complete - slice should already be applied');
      
      // Clear timeout - report loaded successfully
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      // Verify what slice is actually active
      const currentReport = pivotRef.current.getReport();
      console.log('✅ Current slice configuration:', currentReport?.slice);

      // Debug: Show available fields to verify names match
      console.log('Available hierarchies:', pivotRef.current.getAllHierarchies());
      console.log('Available measures:', pivotRef.current.getAllMeasures());

      if (onReportComplete) {
        onReportComplete(pivotRef.current);
      }
    });

    (window as any).__pivotInstance = pivotRef.current;

    return () => {
      // Clear timeout on cleanup
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      if (pivotRef.current) {
        pivotRef.current.dispose();
        pivotRef.current = null;
      }
    };
  }, [data, initialSlice, assetsLoaded]);

  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return Number(obj);
    if (obj instanceof Uint8Array) {
      const view = new DataView(obj.buffer, obj.byteOffset, obj.byteLength);
      return Number(view.getBigUint64(0, true));
    }
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        result[key] = deepSanitize(obj[key]);
      }
      return result;
    }
    return obj;
  }

  /**
   * Build metadata object for WebDataRocks
   * CRITICAL: First element in data array must be metadata
   * Includes availableAggregations for measures
   */
  function buildUsersMetadata(columns: string[]) {
    const metadataObj: any = {};
    
    // Field categories for aggregation rules (users table)
    const ID_FIELDS = ['user_key', 'user_id', 'email', 'first_device_id', 'last_device_id'];
    const BINARY_FLAGS = [
      'has_activated',
      'is_active_7d',
      'is_active_30d',
      'is_paying_customer'
    ];
    
    columns.forEach(col => {
      const fieldMeta = getFieldMetadata(col);
      
      if (fieldMeta) {
        // Map metadata type to WebDataRocks format
        const metaConfig: any = {
          type: fieldMeta.type,
          ...(fieldMeta.hierarchy && { hierarchy: fieldMeta.hierarchy }),
          ...(fieldMeta.parent && { parent: fieldMeta.parent })
        };
        
        // Add availableAggregations for measures
        if (fieldMeta.type === 'number') {
          if (ID_FIELDS.includes(col)) {
            metaConfig.availableAggregations = ["count", "distinctcount"];
          } else if (BINARY_FLAGS.includes(col)) {
            metaConfig.availableAggregations = ["sum", "avg"];
          } else {
            metaConfig.availableAggregations = ["sum", "max", "min", "avg"];
          }
        } else if (fieldMeta.type === 'string' && ID_FIELDS.includes(col)) {
          // String IDs also get count aggregations
          metaConfig.availableAggregations = ["count", "distinctcount"];
        }
        
        metadataObj[col] = metaConfig;
      } else {
        // Default to number type if not in metadata
        console.warn(`WebDataRocksPivot: No metadata for "${col}", defaulting to number`);
        metadataObj[col] = { 
          type: "number",
          availableAggregations: ["sum", "max", "min", "avg"]
        };
      }
    });
    
    console.log('WebDataRocksPivot: Built metadata object:', metadataObj);
    return metadataObj;
  }

  return <div ref={containerRef} style={{ width: '100%' }} />;
}