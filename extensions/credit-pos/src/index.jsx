import React from "react";
import { Tile, render, useExtensionApi } from "@shopify/retail-ui-extensions-react";

const TileComponent = () => {
  const api = useExtensionApi();

  const handlePress = () => {
    if (api.navigation?.navigate) {
      api.navigation.navigate("pos.home.modal.render");
    }
  };

  return (
    <Tile
      title="Store Credit & VIP"
      subtitle="Lookup balances & apply to cart"
      enabled={true}
      badgeValue="Active"
      onPress={handlePress}
    />
  );
};

export default render("pos.home.tile.render", () => <TileComponent />);
