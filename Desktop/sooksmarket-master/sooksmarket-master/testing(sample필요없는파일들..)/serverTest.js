function(callback){


      for(var i=0; i<reserve_result.length; i++){

          client.query(sql,[reserve_result[i].product_id],function(err,result){

          pname[i]=result[0].product_name;


        });

      };

callback(null);
    },
    function(callback){
      sql='SELECT product_name FROM ProductInfo WHERE product_id=?';

      client.query(sql,[reserve_result[i].product_id],function(err,result){
        
      }
    }
