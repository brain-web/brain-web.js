# brain-web.js

## Bring the brain-web community to your website!

BrainWeb is a permanent virtual space for online collaborations on projects related to neuroscience.
Inspired by initiatives such as Brainhack Global, the OHBM Hackathon, and the OHBM Equinox Brain Twitter Conference, BrainWeb aims at providing an online workspace to facilitate distributed collaboration on a continuous basis.

## Basic Usage

```html
  <script src="../brain-web.js"></script>
  <script>
    window.onload = function () {

      BrainWeb.on('data', function ({ people, skills }) {
        BrainWeb.vis.buildNetwork(people, {
          width: document.body.clientWidth,
          height: document.body.clientHeight,
          zoom: 2,
        })
          .then((svg) => {
            document.body.appendChild(svg);
          })
          .catch(console.log);
      });

      BrainWeb.init();

    };
  </script>
```