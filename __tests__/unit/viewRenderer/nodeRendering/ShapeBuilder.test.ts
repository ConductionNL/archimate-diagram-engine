import { ShapeBuilder } from '../../../../lib/viewRenderer/nodeRendering/ShapeBuilder';
import { ViewSettings } from '../../../../lib/viewRenderer/ViewSettings';
import { expect } from 'chai';

describe('ShapeBuilder', () => {
  const shapeBuilder: ShapeBuilder = new ShapeBuilder(new ViewSettings({}));

  it('should return attributes', () => {
    const shapeAttributes = {
      strokeColor: 'black',
      fillColor: 'white',
      elementName: 'Node 1',
      refX: '42.5%',
      textAnchor: 'middle',
    };
    const { body, label } = shapeBuilder.getAttributes(shapeAttributes);

    expect(label)
      .to.deep.include({
        textWrap: {
          text: shapeAttributes.elementName,
          width: '70%',
          height: '100%',
          ellipsis: true,
        },
      })
      .contain({
        fill: 'black',
        textVerticalAnchor: 'top',
        textAnchor: shapeAttributes.textAnchor,
        refX: shapeAttributes.refX,
        refY: 10,
        refWidth: '100%',
        refHeight: '100%',
        fontSize: 12,
      });
    expect(body).to.contain({
      fill: shapeAttributes.fillColor,
      stroke: shapeAttributes.strokeColor,
      rx: 0,
      ry: 0,
      strokeWidth: 0.8,
    });
  });
});
