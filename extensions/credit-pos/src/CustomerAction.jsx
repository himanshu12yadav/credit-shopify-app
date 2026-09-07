import React from "react";
import { Button, render, useExtensionApi } from "@shopify/retail-ui-extensions-react";

const CustomerAction = () => {
  const api = useExtensionApi();
  return (
    <Button
      title="View Credit & VIP Profile"
      type="secondary"
      onPress={() => {
        if (api?.navigation?.navigate) {
          api.navigation.navigate("pos.home.modal.render");
        }
      }}
    />
  );
};

export default render("pos.customer-details.action.render", () => <CustomerAction />);
