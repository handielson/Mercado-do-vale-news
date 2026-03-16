const url = "https://cqbdyxxzmkgeghwkozts.supabase.co/rest/v1/products?name=ilike.*Poco%20M3*&select=id,name,sku,bling_id,model_id,status,parent_id";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3NzU4MTUsImV4cCI6MjA1NDM1MTgxNX0.YcPZKqJDzVwdXrTKHNz0bqKFiTdYVZKmVOuKWxbQDQo";
fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(console.error);
