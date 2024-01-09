"use client";

import "./SwaggerUIClient.css";
import type { ComponentProps } from "react";
import React from "react";
import _SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

// Create the layout component
// class AugmentingLayout extends React.Component {
//   render() {
//     const { getComponent } = this.props;
//     const BaseLayout = getComponent("BaseLayout", true);
//     return (
//       <div className="not-prose">
//         <BaseLayout />
//       </div>
//     );
//   }
// }

// const AugmentingLayoutPlugin = () => {
//   return {
//     components: {
//       AugmentingLayout: AugmentingLayout,
//     },
//   };
// };

export default function SwaggerUI(props: ComponentProps<typeof _SwaggerUI>) {
  return (
    <div className="not-prose">
      <_SwaggerUI
        {...props}
        persistAuthorization={true}
        // plugins={[AugmentingLayoutPlugin]}
        // layout="AugmentingLayout"
      />
    </div>
  );
}
