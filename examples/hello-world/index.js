const gophress = require('../../');

const app = gophress();

app.get('/', (req, res) => {
  res.send('Hello World\r\n');
});

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Gophress started on port 3000');
}
