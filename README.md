# Gophress

Gophress is a fork of [Express](https://expressjs.com) framework for
[Gopher](https://en.wikipedia.org/wiki/Gopher_(protocol)) instead of HTTP.

Work in progress.

```js
var gophress = require('gophress');
var app = gophress();

app.get('/hello', (req, res) => {
  res.send('Hello World');
});

app.listen(3000)
```

## People

The original author of Express is [TJ Holowaychuk](https://github.com/tj)

[List of all contributors](https://github.com/RauliL/gophress/graphs/contributors)

## License

  [MIT](LICENSE)
