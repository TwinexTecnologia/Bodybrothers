import React from "react";
import { render } from "@testing-library/react-native";
import ExerciseSetCard from "../components/ExerciseSetCard";

describe("ExerciseSetCard", () => {
  it("usa layout empilhado e mantém a hierarquia label > sets > load > rest quando variant=stacked", () => {
    const prefix = "t";
    const { getByTestId } = render(
      <ExerciseSetCard
        variant="stacked"
        label="AQUECIMENTO"
        accentColor="#ea580c"
        backgroundColor="#fff7ed"
        borderColor="#ffedd5"
        series="1 a 2"
        reps="3 a 6"
        load="alta"
        rest="90-180s"
        testIDPrefix={prefix}
      />,
    );

    const layout = getByTestId(`${prefix}-layout`);
    expect(layout).not.toHaveStyle({ flexDirection: "row" });

    const children = React.Children.toArray(layout.props.children) as Array<any>;
    expect(children[0]?.props?.testID).toBe(`${prefix}-line-label`);
    expect(children[1]?.props?.testID).toBe(`${prefix}-line-sets`);
    expect(children[2]?.props?.testID).toBe(`${prefix}-line-load`);
    expect(children[3]?.props?.testID).toBe(`${prefix}-line-rest`);
  });

  it("mantém layout horizontal quando variant=horizontal e permite transição por rerender", () => {
    const prefix = "t2";
    const rendered = render(
      <ExerciseSetCard
        variant="horizontal"
        label="TRABALHO"
        accentColor="#16a34a"
        backgroundColor="#f0fdf4"
        borderColor="#dcfce7"
        series="3"
        reps="10"
        load="alta"
        rest="60s"
        testIDPrefix={prefix}
      />,
    );

    expect(rendered.getByTestId(`${prefix}-layout`)).toHaveStyle({
      flexDirection: "row",
    });

    rendered.rerender(
      <ExerciseSetCard
        variant="stacked"
        label="TRABALHO"
        accentColor="#16a34a"
        backgroundColor="#f0fdf4"
        borderColor="#dcfce7"
        series="3"
        reps="10"
        load="alta"
        rest="60s"
        testIDPrefix={prefix}
      />,
    );

    expect(rendered.getByTestId(`${prefix}-layout`)).not.toHaveStyle({
      flexDirection: "row",
    });
  });
});

