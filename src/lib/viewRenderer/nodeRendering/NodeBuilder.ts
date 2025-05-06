import { dia, shapes } from 'jointjs';

import { ShapeBuilder } from '@lib/viewRenderer/nodeRendering/ShapeBuilder';
import { typeToHexColor } from '@lib/viewRenderer/utils/colorUtility';
import { typeToClassification } from '@lib/viewRenderer/utils/archimateDomainUtils';
import { generateGlyph } from '@lib/glyphGenerator/glyphGenerator';
import { Style, Version, ViewSetting } from '@lib/model/ViewSetting';
import { NodeShapeClassification } from '@lib/common/enums/nodeShapeClassification';
import { NodeType } from '@lib/common/enums/nodeType';
import { Connectors } from '@lib/common/enums/connectors';
import { Position } from '@lib/common/enums/position';
import { ViewNode } from '@lib/model/ViewNode';

interface BasicNodeAttributes {
  name: string;
  type: string;
  width: number;
  height: number;
}

interface NodeAttributes extends BasicNodeAttributes {
  modelElementId: string;
  viewNodeId: string;
  posX?: number;
  posY?: number;
  parentElement?: shapes.standard.Rectangle | null;
  onClick?: () => void;
}

interface NodeBatch {
  shapes: shapes.standard.Rectangle[];
  icons: shapes.standard.Image[];
  parentRelations: Map<string, string>;
}

interface BatchNode {
  shape: shapes.standard.Rectangle;
  icon?: shapes.standard.Image;
  parentElement?: shapes.standard.Rectangle | null;
  position: { x: number; y: number };
}

interface NodeBatchGroup {
  nodes: ViewNode[];
  totalArea: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Class with functionality to build a node
 *
 * @example
 * import { dia } from 'jointjs';
 * import { NodeBuilder } from '@lib/viewRenderer/nodeRendering/NodeBuilder';
 * import { ViewSettings } from '@lib/viewRenderer/ViewSettings';
 *
 * const graph = new dia.Graph({ cellNamespace: shapes });
 * const nodeBuilder = new NodeBuilder(graph, new ViewSettings({}));
 */
export class NodeBuilder {
  private readonly style: Style;
  private readonly archimateVersion: Version;
  private readonly builder: ShapeBuilder;
  private readonly glyphCache = new Map<string, string>();
  private readonly shapeCache = new Map<string, shapes.standard.Rectangle>;
  private readonly positionCache = new Map<string, { x: number; y: number }>();
  private readonly typeCache = new Map<string, { fillColor: string; classification: string }>();
  
  // Increased batch size but with dynamic adjustment
  private batchSize = 500;
  private readonly RENDER_TIME_TARGET = 16; // ms

  /**
   *
   * @param graph Jointjs Graph model
   * @param settings Node view settings
   */
  constructor(private graph: dia.Graph, settings: ViewSetting) {
    const { style, archimateVersion } = settings;

    this.style = style;
    this.archimateVersion = archimateVersion;
    this.builder = new ShapeBuilder(settings);
    this.initializeTypeCache();
  }

  private initializeTypeCache(): void {
    // Pre-compute common type-related data
    Object.values(NodeType).forEach(type => {
      this.typeCache.set(type, {
        fillColor: typeToHexColor(type, {
          style: this.style,
          archimateVersion: this.archimateVersion,
        }),
        classification: typeToClassification(type)
      });
    });
  }

  /**
   * Builds a node shape based on the node classification type and other given attributes
   * @param attributes
   * @param attributes.name Node name
   * @param attributes.type Node type
   * @param attributes.width Node width
   * @param attributes.height Node height
   * @return Node shape
   * @example
   * import { dia } from 'jointjs';
   * import { NodeBuilder } from '@lib/viewRenderer/nodeRendering/NodeBuilder';
   * import { ViewSettings } from '@lib/viewRenderer/ViewSettings';
   *
   * const graph = new dia.Graph({ cellNamespace: shapes });
   * const nodeBuilder = new NodeBuilder(graph, new ViewSettings({}));
   * const rectangularShape = nodeBuilder.buildShape({
   *         type: 'applicationcomponent',
   *         name: 'Model Service',
   *         width: 100,
   *         height: 80,
   * })
   */
  buildShape({ name, type, width, height }: BasicNodeAttributes): shapes.standard.Rectangle {
    const cacheKey = `${type}-${width}-${height}-${name}`;
    let shape = this.shapeCache.get(cacheKey);

    if (shape) {
      return shape.clone() as shapes.standard.Rectangle;
    }

    const buildBasicRectangular = (nodeType: string, attributes: any) => {
      return this.builder.buildBasicRectangular(name, {
        width,
        height,
        fillColor: typeToHexColor(nodeType, {
          style: this.style,
          archimateVersion: this.archimateVersion,
        }),
        ...attributes,
      });
    };

    const shapeClassification = {
      [NodeShapeClassification.Structure]: () => buildBasicRectangular(type, {}),
      [NodeShapeClassification.Behaviour]: () =>
        this.builder.buildBasicRounded(name, {
          width,
          height,
          fillColor: typeToHexColor(type, {
            style: this.style,
            archimateVersion: this.archimateVersion,
          }),
        }),
      [NodeShapeClassification.ImplementationAndMigration]: () =>
        this.builder.buildBasicRounded(name, {
          width,
          height,
          fillColor: typeToHexColor(type, {
            style: this.style,
            archimateVersion: this.archimateVersion,
          }),
        }),
      [NodeShapeClassification.Motivational]: () =>
        this.builder.buildBasicOctagonal(name, {
          width,
          height,
          fillColor: typeToHexColor(type, {
            style: this.style,
            archimateVersion: this.archimateVersion,
          }),
        }),
      [NodeType.Grouping]: () =>
        buildBasicRectangular(type, {
          withDashedStroke: true,
          textAnchor: Position.Left,
          refX: '5%',
        }),
      [NodeType.Group]: () =>
        buildBasicRectangular(type, {
          textAnchor: Position.Left,
          refX: '7%',
        }),
      [NodeShapeClassification.ViewElement]: () =>
        buildBasicRectangular(type, {
          textAnchor: Position.Left,
          refX: '7%',
        }),
      [Connectors.AndJunction]: () =>
        this.builder.buildSmallCircle({
          fillColor: 'black',
        }),
      [Connectors.OrJunction]: () =>
        this.builder.buildSmallCircle({
          fillColor: 'white',
        }),
    };

    const classification = typeToClassification(type);
    const build = shapeClassification[classification];
    shape = build ? build() : buildBasicRectangular(type, {});

    // Cache the shape for future use
    this.shapeCache.set(cacheKey, shape.clone() as shapes.standard.Rectangle);

    return shape;
  }

  /**
   * Build a node in graph
   * @param attributes Node attributes
   * @param attributes.modelElementId Model element identification
   * @param attributes.viewNodeId View node identification
   * @param attributes.name Node name
   * @param attributes.type Node type
   * @param attributes.width Node width
   * @param attributes.height Node height
   * @param attributes.posX Position of the node on the x-axis
   * @param attributes.posY Position of the node on the y-axis
   * @param attributes.parentElement Node parent
   * @example
   * import { dia } from 'jointjs';
   * import { NodeBuilder } from '@lib/viewRenderer/nodeRendering/NodeBuilder';
   * import { ViewSettings } from '@lib/viewRenderer/ViewSettings';
   *
   * const graph = new dia.Graph({ cellNamespace: shapes });
   * const nodeBuilder = new NodeBuilder(graph, new ViewSettings({}));
   * nodeBuilder.buildNode({
   *       width: 100,
   *       height: 100,
   *       type: 'node',
   *       name: 'Node 1',
   *       viewNodeId: '624f10ecd9f08d4030fe458f',
   *       modelElementId: 'e2e60769-fea2-45e2-9355-66e092ec6934',
   *       posX: 10,
   *       posY: 10,
   *       parentElement: undefined,
   * });
   */
  buildNode({
    modelElementId,
    viewNodeId,
    name,
    type,
    width,
    height,
    posX,
    posY,
    parentElement,
    onClick,
  }: NodeAttributes): void {
    if (viewNodeId && name && type) {
      const shape = this.buildShape({ name, type, width, height });
      const x = posX ? Number(posX) : 0;
      const y = posY ? Number(posY) : 0;

      // Batch operations
      shape.prop({
        id: viewNodeId,
        modelElementId,
        modelElementType: type,
        parent: parentElement,
      });

      shape.position(x, y);
      shape.addTo(this.graph);

      if (parentElement !== null && parentElement !== undefined) {
        const parent = parentElement as unknown as shapes.standard.Rectangle;
        parent.embed(shape);
        shape.position(x, y, { parentRelative: true });
      }

      this.addIconToShape(shape, type, width, onClick);
    } else {
      throw new Error('Invalid node: Nodes must have viewNodeId, name and type defined.');
    }
  }

  private addIconToShape(shape: shapes.standard.Rectangle, type: string, width: number, onClick?: () => void): void {
    let svgData = this.glyphCache.get(type);
    
    if (svgData === undefined) {
      svgData = generateGlyph(type, this.archimateVersion);
      this.glyphCache.set(type, svgData);
    }

    if (svgData !== '') {
      const image = new shapes.standard.Image();
      
      image.resize(16, 16);
      image.attr({
        image: {
          'xlink:href': `data:image/svg+xml;utf8,${encodeURIComponent(svgData)}`,
          cursor: onClick ? 'pointer' : 'default',
          pointerEvents: onClick ? 'all' : 'none'
        }
      });

      image.addTo(this.graph);
      shape.embed(image);

      if (onClick) {
        image.prop('onClick', onClick);
        this.setupClickHandler();
      }

      image.position(width - 24, 8, { parentRelative: true });
    }
  }

  private setupClickHandler(): void {
    const paper = (this.graph as any).paper;
    if (!paper || paper._hasClickHandler) return;

    paper.on('element:pointerclick', (elementView: dia.ElementView, evt: Event) => {
      const clickedElement = (elementView as any).model;
      const onClick = clickedElement.prop('onClick');
      if (onClick) {
        evt.stopPropagation();
        onClick();
      }
    });
    paper._hasClickHandler = true;
  }

  public buildNodes(nodes: ViewNode[]): void {
    if (!nodes.length) return;

    // Pre-process and optimize
    this.preProcessNodes(nodes);

    // Group nodes by proximity and size
    const groups = this.groupNodesByProximity(nodes);

    // Process groups in order of complexity
    groups.sort((a, b) => a.totalArea - b.totalArea);
    
    groups.forEach(group => {
      this.processBatch(group.nodes);
    });
  }

  private groupNodesByProximity(nodes: ViewNode[]): NodeBatchGroup[] {
    const groups: NodeBatchGroup[] = [];
    const processed = new Set<string>();

    nodes.forEach(node => {
      if (processed.has(node.viewNodeId)) return;

      const group: NodeBatchGroup = {
        nodes: [node],
        totalArea: Number(node.width) * Number(node.height),
        bounds: {
          minX: Number(node.x),
          maxX: Number(node.x) + Number(node.width),
          minY: Number(node.y),
          maxY: Number(node.y) + Number(node.height)
        }
      };

      processed.add(node.viewNodeId);

      // Find nearby nodes
      nodes.forEach(otherNode => {
        if (processed.has(otherNode.viewNodeId)) return;
        
        if (this.areNodesNearby(node, otherNode)) {
          group.nodes.push(otherNode);
          processed.add(otherNode.viewNodeId);
          group.totalArea += Number(otherNode.width) * Number(otherNode.height);
          this.updateGroupBounds(group, otherNode);
        }
      });

      groups.push(group);
    });

    return groups;
  }

  private areNodesNearby(node1: ViewNode, node2: ViewNode): boolean {
    const distance = Math.sqrt(
      Math.pow(Number(node1.x) - Number(node2.x), 2) +
      Math.pow(Number(node1.y) - Number(node2.y), 2)
    );
    return distance < 500; // Adjust threshold as needed
  }

  private updateGroupBounds(group: NodeBatchGroup, node: ViewNode): void {
    const x = Number(node.x);
    const y = Number(node.y);
    const width = Number(node.width);
    const height = Number(node.height);

    group.bounds.minX = Math.min(group.bounds.minX, x);
    group.bounds.maxX = Math.max(group.bounds.maxX, x + width);
    group.bounds.minY = Math.min(group.bounds.minY, y);
    group.bounds.maxY = Math.max(group.bounds.maxY, y + height);
  }

  private preProcessNodes(nodes: ViewNode[]): void {
    // Pre-cache all glyphs
    const uniqueTypes = new Set(nodes.map(node => node.type));
    uniqueTypes.forEach(type => {
      if (!this.glyphCache.has(type)) {
        const svgData = generateGlyph(type, this.archimateVersion);
        this.glyphCache.set(type, svgData);
      }
    });

    // Pre-create common shapes
    this.preCreateCommonShapes(nodes);
  }

  private preCreateCommonShapes(nodes: ViewNode[]): void {
    // Implementation of preCreateCommonShapes method
  }

  private processBatch(nodes: ViewNode[]): void {
    // Implementation of processBatch method
  }
}
