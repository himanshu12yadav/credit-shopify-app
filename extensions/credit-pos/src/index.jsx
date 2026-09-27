import React from "react";
import { Tile, reactExtension, useApi } from "@shopify/ui-extensions-react/point-of-sale";

const TileComponent = () => {
  const api = useApi();

  return (
    <Tile
      title="Store Credit & VIP"
      subtitle="Lookup balances & apply to cart"
      enabled={true}
      onPress={() => api.action.presentModal()}
    />
  );
};

export default reactExtension("pos.home.tile.render", () => <TileComponent />);
