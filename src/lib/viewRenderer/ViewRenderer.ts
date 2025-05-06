import { dia } from 'jointjs';
import { ViewNode } from '../model/ViewNode';
import { ViewRelationship } from '../model/ViewRelationship';
import { ViewSetting } from '../model/ViewSetting';
import { NodeBuilder } from './nodeRendering/NodeBuilder';
import { RelationshipBuilder } from './relationshipRendering/RelationshipBuilder';

export const ViewRenderer = {
  /**
   * Converts all node and relationship views to graph
   * @param graph Jointjs Graph model
   * @param nodes View Nodes
   * @param relationships Relationships of nodes
   * @param settings Node view settings
   * @example
   * import { ViewRenderer, ViewSettings } from '../../../index';
   * import { dia, shapes } from 'jointjs';
   *
   * let outputGraph = new dia.Graph({}, {cellNamespace: shapes});
   * let viewNodes = [
   *     {
   *         "identifier": "40eb5bd6-4d7c-4c27-98a8-602f935ed405",
   *         "name": "Resource",
   *         "type": "resource"
   *     },
   *     {
   *         "identifier": "6be02ba1-0489-4ea4-b62b-a22d302cbefe",
   *         "name": "Capability",
   *         "type": "capability"
   *     }
   * ];
   * let viewRelationships = [
   *     {
   *         "identifier": "bc8c928b-dafb-4e61-91b3-7c3e5b93a900",
   *         "sourceId": "40eb5bd6-4d7c-4c27-98a8-602f935ed405",
   *         "targetId": "6be02ba1-0489-4ea4-b62b-a22d302cbefe",
   *         "type": "assignmentrelationship"
   *     }
   * ];
   *
   * ViewRenderer.renderToGraph(
   *         outputGraph,
   *         viewNodes,
   *         viewRelationships,
   *         new ViewSettings({
   *           style: 'hybrid',
   *           darkColor: 'black',
   *           lightColor: 'white',
   *           defaultWidth: 140,
   *           defaultHeight: 50,
   *         }),
   *       );
   */
  renderToGraph(
    graph: dia.Graph,
    nodes: Array<ViewNode>,
    relationships: Array<ViewRelationship>,
    settings: ViewSetting,
  ) {
    const nodeBuilder = new NodeBuilder(graph, settings);
    const relationshipBuilder = new RelationshipBuilder(graph, settings);

    // Clear any existing content
    graph.clear();

    // Start batch operation
    graph.startBatch('render');

    try {
      if (Array.isArray(nodes)) {
        // Pre-process nodes to build parent-child relationships map
        const nodeMap = new Map<string, ViewNode>();
        nodes.forEach(node => {
          if (node.viewNodeId) {
            nodeMap.set(node.viewNodeId, node);
          }
        });

        // Process nodes in their original order with optimized batching
        for (const node of nodes) {
          const parentId = node.parent;
          let parent = null;

          if (parentId !== undefined && parentId !== null) {
            parent = graph.getCell(parentId);
          }

          nodeBuilder.buildNode({
            modelElementId: node.modelNodeId,
            viewNodeId: node.viewNodeId,
            name: node.name,
            type: node.type,
            width: node.width,
            height: node.height,
            posX: node.x,
            posY: node.y,
            parentElement: parent,
            onClick: node.onClick,
          });
        }

        // Process relationships after all nodes with optimized batching
        if (relationships && relationships.length > 0) {
          let source = null,
            target = null,
            parent = null;

          relationships.forEach(rel => {
            source = graph.getCell(rel.sourceId);
            target = graph.getCell(rel.targetId);
            parent = target?.attributes?.parent;

            if (
              source?.attributes.type !== 'standard.Link' &&
              target?.attributes.type !== 'standard.Link'
            ) {
              if (parent === null || parent !== source?.id) {
                relationshipBuilder.buildRelationship({
                  type: rel.type,
                  relationshipModelId: rel.modelRelationshipId,
                  relationshipViewId: rel.viewRelationshipId,
                  isBidirectional: rel.isBidirectional,
                  bendpoints: rel.bendpoints,
                  sourceNode: source,
                  targetNode: target,
                  label: rel.label,
                });
              }
            }
          });
        }
      }

      // Force graph update
      graph.resetCells([...graph.getCells()]);
    } catch (error) {
      console.error('Error during rendering:', error);
      throw error;
    } finally {
      // Stop batch operation
      graph.stopBatch('render');
      
      // Ensure paper fits all content if available
      if ((graph as any).paper) {
        const paper = (graph as any).paper;
        paper.fitToContent({
          padding: 20,
          allowNewOrigin: 'any'
        });
      }
    }
    
    console.timeEnd('totalRender');
  },

  /**
   * Render Graph
   * @param nodes View Nodes
   * @param relationships Relationships of nodes
   * @param settings Node view settings
   * @example
   * let viewNodes = [
   *     {
   *         "identifier": "40eb5bd6-4d7c-4c27-98a8-602f935ed405",
   *         "name": "Resource",
   *         "type": "resource"
   *     },
   *     {
   *         "identifier": "6be02ba1-0489-4ea4-b62b-a22d302cbefe",
   *         "name": "Capability",
   *         "type": "capability"
   *     }
   * ];
   * let viewRelationships = [
   *     {
   *         "identifier": "bc8c928b-dafb-4e61-91b3-7c3e5b93a900",
   *         "sourceId": "40eb5bd6-4d7c-4c27-98a8-602f935ed405",
   *         "targetId": "6be02ba1-0489-4ea4-b62b-a22d302cbefe",
   *         "type": "assignmentrelationship"
   *     }
   * ];
   *
   * ViewRenderer.render(
   *         viewNodes,
   *         viewRelationships,
   *         new ViewSettings({
   *           style: 'hybrid',
   *           darkColor: 'black',
   *           lightColor: 'white',
   *           defaultWidth: 140,
   *           defaultHeight: 50,
   *         }),
   *       );
   */
  render(
    nodes: Array<ViewNode>,
    relationships: Array<ViewRelationship>,
    settings: ViewSetting,
  ): dia.Graph {
    const graph = new dia.Graph();
    this.renderToGraph(graph, nodes, relationships, settings);
    return graph;
  },
};
