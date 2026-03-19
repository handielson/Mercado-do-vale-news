fetch("https://api.xiaomipetrolina.com.br/products?search=cine&_t=" + Date.now())
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
